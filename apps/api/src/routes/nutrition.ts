import {
  filterNutritionPlanForDietarySafety,
  fixtureNutritionPlan,
  localDateSchema,
} from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

/**
 * Real nutrition planning isn't implemented yet — this passes through the
 * shared demo fixture (contract-shaped, date-adjusted) so the endpoint
 * exists and the App can integrate against it ahead of the real feature.
 */
export function createNutritionRouter(repos: Repos): Router {
  const router = Router()

  router.get('/nutrition/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const profile = await repos.profile.get(req.userId)
    const plan = filterNutritionPlanForDietarySafety(
      { ...fixtureNutritionPlan, date },
      profile?.dietarySafety
    )
    ok(res, plan)
  })

  return router
}
