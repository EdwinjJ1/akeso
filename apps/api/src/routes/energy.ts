import { localDateSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

export function createEnergyRouter(repos: Repos): Router {
  const router = Router()

  router.get('/energy/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const result = await repos.energy.get(req.userId, date)
    ok(res, result)
  })

  return router
}
