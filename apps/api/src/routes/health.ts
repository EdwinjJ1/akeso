import { createRequire } from 'node:module'

import { Router } from 'express'

import { ok } from '../http'

const require = createRequire(import.meta.url)
const { version: API_VERSION } = require('../../package.json') as { version: string }

export const healthRouter = Router()

const startedAt = Date.now()

healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok' as const,
    version: API_VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  })
})
