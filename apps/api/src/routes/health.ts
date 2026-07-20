import { Router } from 'express'

import { ok } from '../http'

export const healthRouter = Router()

const startedAt = Date.now()
const API_VERSION = '0.1.0'

healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok' as const,
    version: API_VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  })
})
