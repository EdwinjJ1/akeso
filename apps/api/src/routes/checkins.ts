import { checkInInputSchema, EnergyEngine } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

const energyEngine = new EnergyEngine()

export function createCheckinsRouter(repos: Repos): Router {
  const router = Router()

  router.post('/checkins', async (req, res) => {
    const input = checkInInputSchema.parse(req.body)
    await repos.checkins.upsert(req.userId, input)
    const result = energyEngine.evaluate(input)
    await repos.energy.upsert(req.userId, result)
    ok(res, result)
  })

  return router
}
