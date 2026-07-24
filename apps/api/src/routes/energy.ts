import {
  adjustEnergyBodySchema,
  applyScoreAdjustment,
  localDateSchema,
  mergeRegeneratedPlan,
  planDay,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { notFound } from '../http-error'
import { ok } from '../http'
import type { Repos } from '../repos'

export function createEnergyRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/energy/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const result = await repos.energy.get(req.userId, date)
    ok(res, result)
  })

  /**
   * The user's manual correction of the day's score. The adjusted result
   * replaces the engine's one in storage, so every downstream reader
   * (dashboard, planner, coach, nutrition) sees the corrected day. If a plan
   * already exists it is re-planned around the new energy shape, preserving
   * the user's own edited blocks. Re-submitting the check-in later replaces
   * the whole energy result, which clears the adjustment by design.
   */
  router.post('/energy/:date/adjust', writeRateLimiter, async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { score, note } = adjustEnergyBodySchema.parse(req.body ?? {})

    const existing = await repos.energy.get(req.userId, date)
    if (!existing) {
      throw notFound(
        `No check-in for ${date} yet — submit one before adjusting the score.`
      )
    }

    const adjusted = applyScoreAdjustment(existing, score, {
      note,
      adjustedAt: new Date().toISOString(),
    })
    const savedEnergy = await repos.energy.upsert(req.userId, adjusted)

    const currentPlan = await repos.plans.get(req.userId, date)
    if (!currentPlan) {
      ok(res, { energy: savedEnergy, plan: null })
      return
    }

    const tasks = await repos.tasks.list(req.userId, date)
    const replanned = mergeRegeneratedPlan(
      planDay(savedEnergy, tasks),
      currentPlan
    )
    const savedPlan = await repos.plans.upsert(req.userId, replanned)
    ok(res, { energy: savedEnergy, plan: savedPlan })
  })

  return router
}
