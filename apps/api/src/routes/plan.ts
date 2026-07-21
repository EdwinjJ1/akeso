import {
  fixtureCoachReply,
  localDateSchema,
  mergeRegeneratedPlan,
  PlanBlockNotFoundError,
  PlanBlockOverlapError,
  planDay,
  regeneratePlanBodySchema,
  updatePlanBlock as applyPlanBlockUpdate,
  updatePlanBlockInputSchema,
  updatePlanBlockParamsSchema,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { notFound, validationError } from '../http-error'
import { ok } from '../http'
import type { Repos } from '../repos'

export function createPlanRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/plan/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)

    const existing = await repos.plans.get(req.userId, date)
    if (existing) {
      ok(res, existing)
      return
    }

    const energyResult = await repos.energy.get(req.userId, date)
    if (!energyResult) {
      ok(res, null)
      return
    }

    const tasks = await repos.tasks.list(req.userId, date)
    const plan = await repos.plans.upsert(req.userId, planDay(energyResult, tasks))
    ok(res, plan)
  })

  router.patch(
    '/plan/:date/blocks/:blockId',
    writeRateLimiter,
    async (req, res) => {
      const { date, blockId } = updatePlanBlockParamsSchema.parse(req.params)
      const input = updatePlanBlockInputSchema.parse(req.body ?? {})
      const existing = await repos.plans.get(req.userId, date)
      if (!existing) throw notFound(`No plan exists for ${date}`)

      try {
        const updated = applyPlanBlockUpdate(existing, blockId, input)
        const saved = await repos.plans.upsert(req.userId, updated)
        ok(res, saved)
      } catch (error) {
        if (error instanceof PlanBlockNotFoundError) {
          throw notFound(error.message)
        }
        if (error instanceof PlanBlockOverlapError) {
          throw validationError(error.message)
        }
        throw error
      }
    }
  )

  router.post('/plan/:date/regenerate', writeRateLimiter, async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { instruction } = regeneratePlanBodySchema.parse(req.body ?? {})

    const energyResult = await repos.energy.get(req.userId, date)
    if (!energyResult) {
      throw notFound(
        `No check-in for ${date} yet — submit one before generating a plan.`
      )
    }

    const tasks = await repos.tasks.list(req.userId, date)
    const currentPlan = await repos.plans.get(req.userId, date)
    const freshPlan = planDay(energyResult, tasks)
    const regenerated = instruction
      ? {
          ...freshPlan,
          coachNote: `${freshPlan.coachNote} (Adjusted for: "${instruction}".)`,
        }
      : freshPlan
    const plan = currentPlan
      ? mergeRegeneratedPlan(regenerated, currentPlan)
      : regenerated

    const saved = await repos.plans.upsert(req.userId, plan)
    ok(res, { plan: saved, coach: fixtureCoachReply })
  })

  return router
}
