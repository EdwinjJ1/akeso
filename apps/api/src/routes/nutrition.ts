import {
  buildInventoryNutritionFallback,
  filterNutritionPlanForDietarySafety,
  hydrationLitresFromBand,
  localDateSchema,
  NutritionEngine,
  nutritionPlanSchema,
  type CheckInInput,
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

/**
 * Inventory-backed reads use the deterministic AFCD engine where possible;
 * explicit regeneration uses AI. Unknown items retain the conservative
 * inventory fallback rather than being silently treated as a specific food.
 */
export function createNutritionRouter(
  repos: Repos,
  ai: AiServices,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()
  const nutritionEngine = new NutritionEngine()

  const context = async (userId: string, date: string) => {
    const [fridge, energy, profile, checkin] = await Promise.all([
      repos.fridge.list(userId),
      repos.energy.get(userId, date),
      repos.profile.get(userId),
      repos.checkins.get(userId, date),
    ])
    return { date, fridge, energy, profile, checkin }
  }

  const cacheKey = (
    userId: string,
    input: {
      date: string
      fridge: FridgeItem[]
      energy: EnergyResult | null
      profile: UserProfile | null
      checkin: CheckInInput | null
    }
  ) => {
    const canonicalContext = JSON.stringify({
      date: input.date,
      energy: input.energy && { score: input.energy.score, band: input.energy.band },
      profile: input.profile,
      hydration: input.checkin?.hydration,
      fridge: [...input.fridge].sort((left, right) => left.id.localeCompare(right.id)),
      provider: env.vision.provider,
      model: env.vision.mimoModel,
      promptVersion: NUTRITION_PROMPT_VERSION,
    })
    return createHash('sha256')
      .update(`${userId}:${canonicalContext}`)
      .digest('hex')
  }

  const fallback = (input: Awaited<ReturnType<typeof context>>) => {
    const deterministic = nutritionEngine.plan({
      date: input.date,
      fridge: input.fridge,
      dietaryPreference: input.profile?.dietaryPreference,
      waterIntakeLitres: hydrationLitresFromBand(input.checkin?.hydration),
    })

    return deterministic.meals.length > 0 || input.fridge.length === 0
      ? deterministic
      : buildInventoryNutritionFallback({
          date: input.date,
          fridge: input.fridge,
          energyBand: input.energy?.band ?? 'moderate',
          dietaryPreference: input.profile?.dietaryPreference ?? 'none',
          needs: deterministic.needs,
        })
  }

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
