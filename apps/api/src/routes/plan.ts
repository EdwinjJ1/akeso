import {
  fixtureCoachReply,
  localDateSchema,
  planDay,
  regeneratePlanBodySchema,
} from '@akeso/domain'
import { Router } from 'express'

import { notFound } from '../http-error'
import { ok } from '../http'
import type { Repos } from '../repos'

export function createPlanRouter(repos: Repos): Router {
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

  router.post('/plan/:date/regenerate', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { instruction } = regeneratePlanBodySchema.parse(req.body ?? {})

    const energyResult = await repos.energy.get(req.userId, date)
    if (!energyResult) {
      throw notFound(
        `No check-in for ${date} yet — submit one before generating a plan.`
      )
    }

    const tasks = await repos.tasks.list(req.userId, date)
    const freshPlan = planDay(energyResult, tasks)
    const plan = instruction
      ? {
          ...freshPlan,
          coachNote: `${freshPlan.coachNote} (Adjusted for: "${instruction}".)`,
        }
      : freshPlan

    const saved = await repos.plans.upsert(req.userId, plan)
    ok(res, { plan: saved, coach: fixtureCoachReply })
  })

  return router
}
