import { fixtureNutritionPlan, localDateSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'

/**
 * Real nutrition planning isn't implemented yet — this passes through the
 * shared demo fixture (contract-shaped, date-adjusted) so the endpoint
 * exists and the App can integrate against it ahead of the real feature.
 */
export function createNutritionRouter(): Router {
  const router = Router()

  router.get('/nutrition/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    ok(res, { ...fixtureNutritionPlan, date })
  })

  return router
}
