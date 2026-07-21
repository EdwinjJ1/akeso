import { fridgeItemParamsSchema, putFridgeItemBodySchema } from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

export function createFridgeRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/fridge', async (req, res) => {
    const items = await repos.fridge.list(req.userId)
    ok(res, items)
  })

  router.put('/fridge/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    const body = putFridgeItemBodySchema.parse(req.body)
    const saved = await repos.fridge.upsert(req.userId, { id, ...body })
    ok(res, saved)
  })

  router.delete('/fridge/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    await repos.fridge.remove(req.userId, id)
    ok(res, null)
  })

  return router
}
