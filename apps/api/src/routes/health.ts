import { Router } from 'express'

import { ok } from '../http'
import pkg from '../../package.json' with { type: 'json' }

const { version: API_VERSION } = pkg as { version: string }

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
