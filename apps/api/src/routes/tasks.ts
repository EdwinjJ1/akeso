import { localDateSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

export function createTasksRouter(repos: Repos): Router {
  const router = Router()

  router.get('/tasks', async (req, res) => {
    const date = localDateSchema.parse(req.query.date)
    const tasks = await repos.tasks.list(req.userId, date)
    ok(res, tasks)
  })

  return router
}
