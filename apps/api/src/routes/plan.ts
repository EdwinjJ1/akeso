import {
  localDateSchema,
  mergeRegeneratedPlan,
  PlanBlockNotFoundError,
  PlanBlockOverlapError,
  planDay,
  regeneratePlanBodySchema,
  updatePlanBlock as applyPlanBlockUpdate,
  updatePlanBlockInputSchema,
  updatePlanBlockParamsSchema,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { notFound, validationError } from '../http-error'
import { ok } from '../http'
import type { Repos } from '../repos'
import type { AiServices } from '../services/types'

export function createPlanRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler,
  ai: AiServices
): Router {
  const router = Router()

  router.get('/plan/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)

    const existing = await repos.plans.get(req.userId, date)
    if (existing) {
      ok(res, existing)
      return
    }

    const energyResult = await repos.energy.get(req.userId, date)
    if (!energyResult) {
      ok(res, null)
      return
    }

    // AI-generated (validated server-side), with the deterministic planner
    // as the provider-internal fallback — never canned content.
    const [tasks, profile, contextNotes] = await Promise.all([
      repos.tasks.list(req.userId, date),
      repos.profile.get(req.userId),
      repos.contextNotes.list(req.userId, date),
    ])
    const generated = await ai.generatePlan({
      date,
      energy: energyResult,
      tasks,
      profile,
      contextNotes,
    })
    const plan = await repos.plans.upsert(req.userId, generated)
    ok(res, plan)
  })

  router.patch(
    '/plan/:date/blocks/:blockId',
    writeRateLimiter,
    async (req, res) => {
      const { date, blockId } = updatePlanBlockParamsSchema.parse(req.params)
      const input = updatePlanBlockInputSchema.parse(req.body ?? {})
      const existing = await repos.plans.get(req.userId, date)
      if (!existing) throw notFound(`No plan exists for ${date}`)

      try {
        const updated = applyPlanBlockUpdate(existing, blockId, input)
        const updatedBlock = updated.blocks.find((block) => block.id === blockId)
        if (!updatedBlock) throw new PlanBlockNotFoundError(blockId)
        await repos.plans.updateBlock(req.userId, date, updatedBlock)
        ok(res, updated)
      } catch (error) {
        if (error instanceof PlanBlockNotFoundError) {
          throw notFound(error.message)
        }
        if (error instanceof PlanBlockOverlapError) {
          throw validationError(error.message)
        }
        throw error
      }
    }
  )

  router.post('/plan/:date/regenerate', writeRateLimiter, async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const { instruction } = regeneratePlanBodySchema.parse(req.body ?? {})

    const energyResult = await repos.energy.get(req.userId, date)
    if (!energyResult) {
      throw notFound(
        `No check-in for ${date} yet — submit one before generating a plan.`
      )
    }

    const tasks = await repos.tasks.list(req.userId, date)
    const currentPlan = await repos.plans.get(req.userId, date)
    const freshPlan = planDay(energyResult, tasks)
    const regenerated = instruction
      ? {
          ...freshPlan,
          coachNote: `${freshPlan.coachNote} (Adjusted for: "${instruction}".)`,
        }
      : freshPlan
    const plan = currentPlan
      ? mergeRegeneratedPlan(regenerated, currentPlan)
      : regenerated

    const saved = await repos.plans.upsert(req.userId, plan)
    const [profile, checkin, fridge, contextNotes] = await Promise.all([
      repos.profile.get(req.userId),
      repos.checkins.get(req.userId, date),
      repos.fridge.list(req.userId),
      repos.contextNotes.list(req.userId, date),
    ])
    const coach = await ai.generateCoachReply({
      date,
      message: instruction ?? 'Walk me through today’s plan.',
      history: [],
      intent: 'chat',
      energy: energyResult,
      plan: saved,
      profile,
      checkin,
      fridge,
      // Report metrics stay out of the plan-regeneration reply on purpose:
      // this path narrates the schedule; the chat route carries the full
      // health picture.
      reports: [],
      contextNotes,
    })
    ok(res, { plan: saved, coach })
  })

  return router
}
