import { createRequire } from 'node:module'

import { Router } from 'express'

import { ok } from '../http'

const require = createRequire(import.meta.url)
const { version: API_VERSION } = require('../../package.json') as { version: string }

export const healthRouter = Router()

const startedAt = Date.now()

export function elapsedSeconds(startedAtMs: number, nowMs = Date.now()): number {
  return Math.floor((nowMs - startedAtMs) / 1000)
}

healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok' as const,
    version: API_VERSION,
    uptimeSeconds: elapsedSeconds(startedAt),
  })
})
