import { fixtureFridge, localDateSchema, NutritionEngine } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'

/**
 * Issue #22 supplies the deterministic mapping. Issue #21 will replace the
 * fixture input with the authenticated user's persisted fridge inventory.
 */
export function createNutritionRouter(): Router {
  const router = Router()
  const nutritionEngine = new NutritionEngine()

  router.get('/nutrition/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    ok(res, nutritionEngine.plan({ date, fridge: fixtureFridge }))
  })

  return router
}
