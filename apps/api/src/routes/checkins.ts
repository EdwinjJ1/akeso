import { checkInInputSchema, EnergyEngine } from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { ok } from '../http'
import { loadEnergyHistory } from '../energy-history'
import type { Repos } from '../repos'

const energyEngine = new EnergyEngine()

export function createCheckinsRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.post('/checkins', writeRateLimiter, async (req, res) => {
    const input = checkInInputSchema.parse(req.body)
    // Load first so updating the same date cannot count today's check-in as
    // its own history.
    const context = await loadEnergyHistory(repos, req.userId, input.date)
    await repos.checkins.upsert(req.userId, input)
    const result = energyEngine.evaluate(input, context)
    await repos.energy.upsert(req.userId, result)
    ok(res, result)
  })

  return router
}
