import { userProfileSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

export function createProfileRouter(repos: Repos): Router {
  const router = Router()

  router.get('/profile', async (req, res) => {
    const profile = await repos.profile.get(req.userId)
    ok(res, profile)
  })

  router.put('/profile', async (req, res) => {
    const profile = userProfileSchema.parse(req.body)
    const saved = await repos.profile.upsert(req.userId, profile)
    ok(res, saved)
  })

  return router
}
