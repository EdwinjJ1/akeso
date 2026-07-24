import { localDateSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'
import { buildCoachReplyFromPlan, COACH_DISCLAIMER } from '../services/coach'

const NO_PLAN_GREETING =
  'Hey, I’m Akeso. Complete today’s 20-second check-in and I can explain your energy and shape your plan with you.'

/**
 * The opening coach message shown before the user says anything. It is
 * derived from the user's persisted plan (never a fixture), and stays
 * deterministic — the AI coach only runs when the user actually sends a
 * message (POST /plan/:date/regenerate).
 */
export function createCoachRouter(repos: Repos): Router {
  const router = Router()

  router.get('/coach/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const plan = await repos.plans.get(req.userId, date)
    if (plan) {
      ok(res, buildCoachReplyFromPlan(plan))
      return
    }
    ok(res, {
      message: NO_PLAN_GREETING,
      suggestions: [],
      disclaimer: COACH_DISCLAIMER,
    })
  })

  return router
}
