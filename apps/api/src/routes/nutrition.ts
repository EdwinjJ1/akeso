import {
  fixtureFridge,
  hydrationLitresFromBand,
  localDateSchema,
  NutritionEngine,
} from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

/**
 * Issue #22 supplies the deterministic mapping. Issue #21 will replace the
 * fixture fridge input with the authenticated user's persisted inventory;
 * the saved profile preference and same-day check-in hydration already come
 * from the real repos.
 */
export function createNutritionRouter(repos: Repos): Router {
  const router = Router()
  const nutritionEngine = new NutritionEngine()

  router.get('/nutrition/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const [profile, checkin] = await Promise.all([
      repos.profile.get(req.userId),
      repos.checkins.get(req.userId, date),
    ])

    ok(
      res,
      nutritionEngine.plan({
        date,
        fridge: fixtureFridge,
        dietaryPreference: profile?.dietaryPreference,
        waterIntakeLitres: hydrationLitresFromBand(checkin?.hydration),
      })
    )
  })

  return router
}
