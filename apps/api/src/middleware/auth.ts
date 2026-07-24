import type { NextFunction, Request, Response } from 'express'

import { env } from '../env'
import { fail } from '../http'
import { getSupabaseClient } from '../supabase'

declare module 'express-serve-static-core' {
  interface Request {
    userId: string
  }
}

const BEARER_PREFIX = 'Bearer '

/**
 * In local mode (memory or sqlite repo driver — no auth provider available)
 * every request is attributed to a single fixed local user — no token
 * required. Otherwise this verifies a Supabase Auth bearer token and
 * attaches the real user id.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (env.localMode) {
    req.userId = env.demoUserId
    next()
    return
  }

  const header = req.header('authorization')
  const token = header?.startsWith(BEARER_PREFIX)
    ? header.slice(BEARER_PREFIX.length)
    : undefined

  if (!token) {
    fail(res, 401, 'UNAUTHORIZED', 'Missing bearer token')
    return
  }

  const { data, error } = await getSupabaseClient().auth.getUser(token)
  if (error || !data.user) {
    fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token')
    return
  }

  req.userId = data.user.id
  next()
}
