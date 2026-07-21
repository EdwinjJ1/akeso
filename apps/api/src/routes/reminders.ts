import { reminderPreferenceSchema } from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

export function createRemindersRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/reminders', async (req, res) => {
    const pref = await repos.reminders.get(req.userId)
    ok(res, pref)
  })

  router.put('/reminders', writeRateLimiter, async (req, res) => {
    const pref = reminderPreferenceSchema.parse(req.body)
    const saved = await repos.reminders.upsert(req.userId, pref)
    ok(res, saved)
  })

  return router
}
