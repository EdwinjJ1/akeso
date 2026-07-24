import { randomUUID } from 'node:crypto'

import {
  coachChatRequestSchema,
  localDateSchema,
  type ContextNote,
  type HealthReport,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { notFound } from '../http-error'
import { ok } from '../http'
import type { Repos } from '../repos'
import { buildCoachReplyFromPlan, COACH_DISCLAIMER } from '../services/coach'
import type { AiServices, CoachChatInput } from '../services/types'

const NO_PLAN_GREETING =
  'Hey, I’m Akeso. Complete today’s 20-second check-in and I can explain your energy and shape your plan with you.'

/**
 * Only metrics the user explicitly confirmed may reach the AI chat context.
 * Reports left with no confirmed metrics are dropped entirely.
 */
function confirmedReportsOnly(reports: HealthReport[]): HealthReport[] {
  return reports.flatMap((report) => {
    const confirmed = report.metrics.filter((metric) => metric.confirmed)
    return confirmed.length > 0 ? [{ ...report, metrics: confirmed }] : []
  })
}

export function createCoachRouter(
  repos: Repos,
  ai: AiServices,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  /**
   * The opening coach message shown before the user says anything. It is
   * derived from the user's persisted plan (never a fixture), and stays
   * deterministic — the AI coach only runs on real conversation turns.
   */
  router.get('/coach/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const plan = await repos.plans.get(req.userId, date)
    if (plan) {
      ok(res, buildCoachReplyFromPlan(plan))
      return
    }
    ok(res, {
      message: NO_PLAN_GREETING,
      suggestions: [],
      disclaimer: COACH_DISCLAIMER,
    })
  })

  /**
   * A real conversation turn. Unlike POST /plan/:date/regenerate this never
   * rewrites the plan — it only talks, grounded in everything the user has
   * shared: check-in, energy (with any manual adjustment), plan, profile,
   * fridge, confirmed report metrics, and their "Tell Akeso more" notes.
   *
   * intent 'more' additionally persists the user's message as a context
   * note; intent 'opener' asks the coach to start that flow with a single
   * follow-up question, which is persisted as a coach-authored note.
   */
  router.post('/coach/:date/chat', writeRateLimiter, async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { message, history, intent } = coachChatRequestSchema.parse(
      req.body ?? {}
    )

    const energy = await repos.energy.get(req.userId, date)
    if (!energy) {
      throw notFound(
        `No check-in for ${date} yet — complete one so Akeso can talk about your day.`
      )
    }

    const [plan, profile, checkin, fridge, reports, contextNotes] =
      await Promise.all([
        repos.plans.get(req.userId, date),
        repos.profile.get(req.userId),
        repos.checkins.get(req.userId, date),
        repos.fridge.list(req.userId),
        repos.reports.list(req.userId),
        repos.contextNotes.list(req.userId, date),
      ])

    // In the "Tell Akeso more" flow the user's answer becomes part of the
    // day's context — persisted before the AI call so the reply already
    // reasons over it.
    const userNote: ContextNote | null =
      intent === 'more'
        ? await repos.contextNotes.append(req.userId, {
            id: randomUUID(),
            date,
            author: 'user',
            text: message,
            createdAt: new Date().toISOString(),
          })
        : null

    const input: CoachChatInput = {
      date,
      message,
      history,
      intent,
      energy,
      plan,
      profile,
      checkin,
      fridge,
      reports: confirmedReportsOnly(reports),
      contextNotes: userNote ? [...contextNotes, userNote] : contextNotes,
    }

    const reply = await ai.generateCoachReply(input)

    if (intent === 'opener') {
      // Keep the coach's follow-up question so the flow can resume later.
      await repos.contextNotes.append(req.userId, {
        id: randomUUID(),
        date,
        author: 'coach',
        text: reply.message.slice(0, 500),
        createdAt: new Date().toISOString(),
      })
    }

    ok(res, reply)
  })

  return router
}
