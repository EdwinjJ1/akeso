import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from 'express-rate-limit'
import type { Request, Response } from 'express'

import { env } from '../env'
import { fail } from '../http'

/**
 * The global /v1 limiter runs BEFORE requireAuth (so unauthenticated floods
 * are still throttled), which means req.userId is unset there and it keys
 * by IP; the per-route write limiter runs after auth and keys by user. The
 * IP fallback needs the IPv6-normalizing helper, or distinct textual
 * representations of the same address would each get their own quota.
 * NOTE: behind a reverse proxy, set Express's `trust proxy` appropriately
 * or every client shares the proxy's IP bucket.
 */
const keyGenerator = (req: Request) =>
  req.userId ?? (req.ip ? ipKeyGenerator(req.ip) : 'unknown')

const rateLimitedHandler = (_req: Request, res: Response) => {
  fail(res, 429, 'RATE_LIMITED', 'Too many requests — please slow down.')
}

export interface RateLimiters {
  /** All /v1 traffic. */
  apiRateLimiter: RateLimitRequestHandler
  /** Tighter limit for the two endpoints that write and recompute (checkins, plan regenerate). */
  writeRateLimiter: RateLimitRequestHandler
}

/**
 * A factory rather than module-level singletons: each call gets its own
 * counters, so every createApp() call (including one per test) is isolated
 * instead of all sharing one process-wide store keyed on the same demo user.
 */
export function createRateLimiters(): RateLimiters {
  return {
    apiRateLimiter: rateLimit({
      windowMs: env.rateLimit.windowMs,
      limit: env.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: rateLimitedHandler,
    }),
    writeRateLimiter: rateLimit({
      windowMs: env.rateLimit.windowMs,
      limit: env.rateLimit.writeMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: rateLimitedHandler,
    }),
  }
}
