import { randomUUID } from 'node:crypto'

import {
  createContextNoteBodySchema,
  localDateSchema,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { ok } from '../http'
import type { Repos } from '../repos'

/**
 * "Tell Akeso more" context notes: dated free text (mood, food, stress,
 * symptoms, …) that enriches the AI coach's picture of the day. Notes are
 * stored verbatim and only ever surfaced back through the coach context —
 * they are never interpreted clinically or rendered as advice.
 */
export function createContextRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/context/:date/notes', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    ok(res, await repos.contextNotes.list(req.userId, date))
  })

  router.post('/context/:date/notes', writeRateLimiter, async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { text } = createContextNoteBodySchema.parse(req.body ?? {})
    const note = await repos.contextNotes.append(req.userId, {
      id: randomUUID(),
      date,
      author: 'user',
      text,
      createdAt: new Date().toISOString(),
    })
    ok(res, note)
  })

  return router
}
