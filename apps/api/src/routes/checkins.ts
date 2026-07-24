import { checkInInputSchema, EnergyEngine, localDateSchema } from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

const energyEngine = new EnergyEngine()

export function createCheckinsRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.post('/checkins', writeRateLimiter, async (req, res) => {
    const input = checkInInputSchema.parse(req.body)
    await repos.checkins.upsert(req.userId, input)
    const result = energyEngine.evaluate(input)
    await repos.energy.upsert(req.userId, result)
    ok(res, result)
  })

  // The check-in as submitted, so the receipt can offer per-factor edits
  // seeded from the user's real answers even after an app restart.
  router.get('/checkins/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    ok(res, await repos.checkins.get(req.userId, date))
  })

  return router
}
