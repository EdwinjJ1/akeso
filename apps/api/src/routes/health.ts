import { Router } from 'express'

import apiPackage from '../../package.json' with { type: 'json' }
import { ok } from '../http'

export const healthRouter = Router()

const startedAt = Date.now()

export function elapsedSeconds(startedAtMs: number, nowMs = Date.now()): number {
  return Math.floor((nowMs - startedAtMs) / 1000)
}

healthRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok' as const,
    version: apiPackage.version,
    uptimeSeconds: elapsedSeconds(startedAt),
  })
})
