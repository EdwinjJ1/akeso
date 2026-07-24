import {
  energyBandFor,
  planBlueprintSchema,
  type DayPlan,
  type EnergyResult,
  type PlanBlock,
} from '@akeso/domain'

import type { PlanGenerationInput } from './types'

export const PLAN_PROMPT_VERSION = 1

/** Plans stay inside waking hours; anything else is rejected as invalid. */
const DAY_START = '06:00'
const DAY_END = '22:00'

/**
 * Prompt for AI day-plan generation. The model may only schedule the
 * supplied tasks (by exact id) plus original meal/break/recovery blocks; the
 * user's instruction (from plan regeneration) is passed to the model instead
 * of being string-appended to the output. Validation happens server-side in
 * validatePlanBlueprint — the prompt states the rules, the validator
 * enforces them.
 */
export function planPrompt(input: PlanGenerationInput): string {
  const context = {
    date: input.date,
    energy: {
      score: input.energy.score,
      band: input.energy.band,
      headline: input.energy.headline,
      peakWindow: input.energy.peakWindow,
      dipWindow: input.energy.dipWindow,
      curve: input.energy.curve,
      ...(input.energy.adjustment
        ? { userAdjustedTheirScore: true }
        : {}),
    },
    tasks: input.tasks
      .filter((task) => task.status !== 'done')
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        energyDemand: task.energyDemand,
        estimatedMinutes: task.estimatedMinutes,
      })),
    profile: input.profile
      ? {
          goal: input.profile.goal,
          typicalWake: input.profile.typicalWake,
          typicalSleep: input.profile.typicalSleep,
        }
      : null,
    userNotesToday: input.contextNotes.map((note) => note.text),
  }

  return `Plan this user's day (${input.date}) as their energy coach, from the exact JSON context below.

Rules:
- Schedule ONLY the supplied tasks, referencing each by its exact taskId, and never schedule the same taskId twice. You may also add blocks with "taskId": null of type light/break/meal/recovery with short original titles.
- Respect the energy shape: put demanding tasks inside peakWindow hours, low-demand or recovery work inside dipWindow hours, and include at least one meal block around midday.
- Every block: start/end in 24h HH:MM between ${DAY_START} and ${DAY_END}, chronological, non-overlapping, at least 15 minutes long.
- Each block needs a one-sentence rationale grounded ONLY in the context (their real windows, task priorities, their notes). Never invent facts. Never mention how any score is computed.
- coachNote: 1–2 warm sentences summarising the day's strategy in plain language.${
    input.instruction
      ? `\n- The user asked for this adjustment — honour it in the schedule and reflect it in the coachNote: ${JSON.stringify(input.instruction)}`
      : ''
  }
- Return exactly one JSON object with this shape and no markdown:
{"blocks":[{"start":"09:00","end":"10:30","type":"focus","title":"...","taskId":"task-1 or null","rationale":"..."}],"coachNote":"..."}

Context: ${JSON.stringify(context)}`
}

export const planBlueprintJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['blocks', 'coachNote'],
  properties: {
    blocks: {
      type: 'array',
      minItems: 2,
      maxItems: 14,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end', 'type', 'title', 'taskId', 'rationale'],
        properties: {
          start: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
          end: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
          type: {
            type: 'string',
            enum: ['focus', 'light', 'break', 'meal', 'recovery'],
          },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          taskId: { type: ['string', 'null'] },
          rationale: { type: 'string', minLength: 1, maxLength: 280 },
        },
      },
    },
    coachNote: { type: 'string', minLength: 1, maxLength: 400 },
  },
} as const

const bandAtHour = (energy: EnergyResult, hour: number) => {
  const point = energy.curve.reduce((closest, candidate) =>
    Math.abs(candidate.hour - hour) < Math.abs(closest.hour - hour)
      ? candidate
      : closest
  )
  return energyBandFor(point.level)
}

/**
 * Grounds a raw AI plan blueprint into a trustworthy DayPlan, or returns
 * null so the caller falls back to the deterministic planner. Enforced here
 * (not trusted from the prompt): waking-hours bounds, chronological
 * non-overlapping blocks, every taskId belongs to the user and appears at
 * most once, and at least one meal block. Ids, status, source, and
 * energyLevel are always server-assigned.
 */
export function validatePlanBlueprint(
  input: PlanGenerationInput,
  raw: unknown
): DayPlan | null {
  const parsed = planBlueprintSchema.safeParse(raw)
  if (!parsed.success) return null

  const blocks = [...parsed.data.blocks].sort((left, right) =>
    left.start.localeCompare(right.start)
  )

  const knownTaskIds = new Set(
    input.tasks
      .filter((task) => task.status !== 'done')
      .map((task) => task.id)
  )
  const usedTaskIds = new Set<string>()
  let previousEnd = DAY_START
  let mealBlocks = 0

  for (const block of blocks) {
    if (block.start < DAY_START || block.end > DAY_END) return null
    if (block.start < previousEnd) return null
    previousEnd = block.end
    if (block.type === 'meal') mealBlocks += 1
    if (block.taskId !== null) {
      if (!knownTaskIds.has(block.taskId)) return null
      if (usedTaskIds.has(block.taskId)) return null
      usedTaskIds.add(block.taskId)
    }
  }
  if (mealBlocks === 0) return null

  const planBlocks: PlanBlock[] = blocks.map((block, index) => ({
    id: `block-${index + 1}`,
    start: block.start,
    end: block.end,
    type: block.type,
    title: block.title,
    ...(block.taskId === null ? {} : { taskId: block.taskId }),
    status: 'planned',
    source: 'akeso',
    energyLevel: bandAtHour(
      input.energy,
      Number.parseInt(block.start.slice(0, 2), 10)
    ),
    rationale: block.rationale,
  }))

  return {
    date: input.date,
    blocks: planBlocks,
    coachNote: parsed.data.coachNote,
    generatedAt: new Date().toISOString(),
  }
}
