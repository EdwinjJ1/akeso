import {
  buildInventoryNutritionFallback,
  filterNutritionPlanForDietarySafety,
  localDateSchema,
  nutritionPlanSchema,
  type EnergyResult,
  type FridgeItem,
  type NutritionPlan,
  type UserProfile,
} from '@akeso/domain'
import { createHash } from 'node:crypto'
import { Router, type RequestHandler } from 'express'

import { env } from '../env'
import { ok } from '../http'
import type { Repos } from '../repos'
import { NUTRITION_PROMPT_VERSION } from '../services/mimo'
import type { AiServices } from '../services/types'

/** Inventory-backed nutrition reads are instant; explicit regeneration uses AI. */
export function createNutritionRouter(
  repos: Repos,
  ai: AiServices,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  const context = async (userId: string, date: string) => {
    const [fridge, energy, profile] = await Promise.all([
      repos.fridge.list(userId),
      repos.energy.get(userId, date),
      repos.profile.get(userId),
    ])
    return { date, fridge, energy, profile }
  }

  const cacheKey = (
    userId: string,
    input: {
      date: string
      fridge: FridgeItem[]
      energy: EnergyResult | null
      profile: UserProfile | null
    }
  ) => {
    const canonicalContext = JSON.stringify({
      date: input.date,
      energy: input.energy && { score: input.energy.score, band: input.energy.band },
      profile: input.profile,
      fridge: [...input.fridge].sort((left, right) => left.id.localeCompare(right.id)),
      provider: env.vision.provider,
      model: env.vision.mimoModel,
      promptVersion: NUTRITION_PROMPT_VERSION,
    })
    return createHash('sha256')
      .update(`${userId}:${canonicalContext}`)
      .digest('hex')
  }

  const fallback = (input: Awaited<ReturnType<typeof context>>) =>
    buildInventoryNutritionFallback({
      date: input.date,
      fridge: input.fridge,
      energyBand: input.energy?.band ?? 'moderate',
      dietaryPreference: input.profile?.dietaryPreference ?? 'none',
      needs: [],
    })

  const applyDietarySafety = (
    plan: NutritionPlan,
    profile: UserProfile | null
  ): NutritionPlan =>
    filterNutritionPlanForDietarySafety(plan, profile?.dietarySafety)

  router.get('/nutrition/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const input = await context(req.userId, date)
    const cached = await repos.nutritionPlanCache.get(
      req.userId,
      cacheKey(req.userId, input)
    )
    const parsedCache = cached ? nutritionPlanSchema.safeParse(cached) : null
    const plan = parsedCache?.success ? parsedCache.data : fallback(input)
    ok(res, applyDietarySafety(plan, input.profile))
  })

  router.post(
    '/nutrition/:date/regenerate',
    writeRateLimiter,
    async (req, res) => {
      const date = localDateSchema.parse(req.params.date)
      const input = await context(req.userId, date)
      const plan = nutritionPlanSchema.parse(await ai.generateNutrition(input))
      const safePlan = applyDietarySafety(plan, input.profile)
      await repos.nutritionPlanCache.upsert(
        req.userId,
        cacheKey(req.userId, input),
        safePlan
      )
      ok(res, safePlan)
    }
  )

  return router
}
