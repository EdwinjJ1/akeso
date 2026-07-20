import { fixtureCoachReply, localDateSchema } from '@akeso/domain'
import { Router } from 'express'

import { ok } from '../http'

/** The real coaching feature isn't implemented yet — passes through the shared fixture. */
export function createCoachRouter(): Router {
  const router = Router()

  router.get('/coach/:date', async (req, res) => {
    localDateSchema.parse(req.params.date)
    ok(res, fixtureCoachReply)
  })

  return router
}
