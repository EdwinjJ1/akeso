import { z } from 'zod'

/**
 * Akeso shared contract (Issue #6 — FROZEN once agreed).
 *
 * Single source of truth for the shapes exchanged between App, API, Domain
 * and AI. Every fixture, every API payload and every AI structured output
 * MUST parse against these schemas. Breaking changes require notifying all
 * affected module owners (see docs/TEAM_CONTRACT.md §2).
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/** Self-report scale: 1 = worst, 5 = best. */
export const Scale1to5Schema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])
export type Scale1to5 = z.infer<typeof Scale1to5Schema>

/** Local calendar date, YYYY-MM-DD. */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
export type DateString = z.infer<typeof DateStringSchema>

/** Local wall-clock time, HH:mm, 24h. */
export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm (24h)')
export type TimeString = z.infer<typeof TimeStringSchema>

/** ISO 8601 datetime with timezone offset, e.g. 2026-07-21T08:05:00+10:00. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true })
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>

// ── Check-in ────────────────────────────────────────────────────────────────

/** Bucketed hours of sleep last night. */
export const SleepDurationSchema = z.enum([
  'under_5h',
  '5_6h',
  '6_7h',
  '7_8h',
  '8_9h',
  'over_9h',
  'not_sure',
])
export type SleepDuration = z.infer<typeof SleepDurationSchema>

/** How long ago the last meal was. */
export const LastMealTimingSchema = z.enum([
  'within_1h',
  '1_3h',
  '3_5h',
  'over_5h',
  'not_today',
  'not_sure',
])
export type LastMealTiming = z.infer<typeof LastMealTimingSchema>

/** Rough water intake so far today, in litre bands. */
export const HydrationSchema = z.enum([
  'under_0_5l',
  '0_5_1l',
  '1_1_5l',
  '1_5_2l',
  'over_2l',
  'not_sure',
])
export type Hydration = z.infer<typeof HydrationSchema>

export const CheckInInputSchema = z
  .object({
    date: DateStringSchema,
    /** Self-reported energy right now; 1..5 maps to 20/40/60/80/100. */
    reportedEnergy: Scale1to5Schema,
    sleepDuration: SleepDurationSchema,
    lastMealTiming: LastMealTimingSchema,
    /** Optional free-text description of the last meal (280-char cap, matches server). */
    lastMealDescription: z.string().max(280).optional(),
    hydration: HydrationSchema,
  })
  // Reject unknown keys rather than silently dropping them, so a stale UI
  // still sending legacy fields (sleepHours, caffeine, …) fails loudly during
  // the contract migration instead of posting a half-empty check-in.
  .strict()
export type CheckInInput = z.infer<typeof CheckInInputSchema>

// ── Energy ──────────────────────────────────────────────────────────────────

/** 0–100 integer. Computed by the deterministic EnergyEngine only. */
export const EnergyScoreSchema = z.number().int().min(0).max(100)
export type EnergyScore = z.infer<typeof EnergyScoreSchema>

export const EnergyBandSchema = z.enum(['low', 'moderate', 'high'])
export type EnergyBand = z.infer<typeof EnergyBandSchema>

export const EnergyFactorKeySchema = z.enum([
  'reported_energy',
  'sleep_duration',
  'last_meal',
  'hydration',
])
export type EnergyFactorKey = z.infer<typeof EnergyFactorKeySchema>

/**
 * Whether a factor actually drove the score (`reported_energy`) or is only
 * shown as possible context. Sleep, last meal and hydration are context: they
 * are never forced into a point attribution.
 */
export const EnergyFactorRoleSchema = z.enum([
  'reported_energy',
  'possible_context',
])
export type EnergyFactorRole = z.infer<typeof EnergyFactorRoleSchema>

export const EnergyFactorSchema = z.object({
  key: EnergyFactorKeySchema,
  label: z.string().min(1),
  role: EnergyFactorRoleSchema,
  /**
   * Signed integer points this factor contributed to the score. Only set on
   * the `reported_energy` factor; `possible_context` factors are
   * informational and deliberately carry no attribution.
   */
  impact: z.number().int().min(-50).max(50).optional(),
  explanation: z.string().min(1),
})
export type EnergyFactor = z.infer<typeof EnergyFactorSchema>

export const EnergyCurvePointSchema = z.object({
  hour: z.number().int().min(0).max(23),
  /** 0–100 predicted energy at this hour. */
  level: EnergyScoreSchema,
})
export type EnergyCurvePoint = z.infer<typeof EnergyCurvePointSchema>

export const HourWindowSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((w) => w.endHour > w.startHour, {
    message: 'endHour must be after startHour',
  })
export type HourWindow = z.infer<typeof HourWindowSchema>

export const EnergyResultSchema = z.object({
  date: DateStringSchema,
  score: EnergyScoreSchema,
  band: EnergyBandSchema,
  /** One-line human summary, e.g. "Solid morning ahead — protect 9–11am." */
  headline: z.string().min(1),
  factors: z.array(EnergyFactorSchema).min(1),
  curve: z.array(EnergyCurvePointSchema).min(2),
  peakWindow: HourWindowSchema,
  dipWindow: HourWindowSchema,
  computedAt: IsoDateTimeSchema,
})
export type EnergyResult = z.infer<typeof EnergyResultSchema>

// ── Tasks & plan ────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(['must', 'should', 'could'])
export type TaskPriority = z.infer<typeof TaskPrioritySchema>

export const EnergyDemandSchema = z.enum(['high', 'medium', 'low'])
export type EnergyDemand = z.infer<typeof EnergyDemandSchema>

export const TaskStatusSchema = z.enum(['todo', 'scheduled', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  priority: TaskPrioritySchema,
  energyDemand: EnergyDemandSchema,
  estimatedMinutes: z.number().int().positive(),
  status: TaskStatusSchema,
})
export type Task = z.infer<typeof TaskSchema>

export const PlanBlockTypeSchema = z.enum([
  'focus',
  'light',
  'break',
  'meal',
  'recovery',
])
export type PlanBlockType = z.infer<typeof PlanBlockTypeSchema>

export const PlanBlockSchema = z
  .object({
    id: z.string().min(1),
    start: TimeStringSchema,
    end: TimeStringSchema,
    type: PlanBlockTypeSchema,
    title: z.string().min(1),
    taskId: z.string().min(1).optional(),
    /** Predicted energy band during this block. */
    energyLevel: EnergyBandSchema,
    /** Why the planner put it here — always evidence-based. */
    rationale: z.string().min(1),
  })
  // Zero-padded HH:mm compares correctly as a string. Blocks stay within one
  // local day — overnight blocks are out of scope for the demo.
  .refine((b) => b.end > b.start, { message: 'end must be after start' })
export type PlanBlock = z.infer<typeof PlanBlockSchema>

export const DayPlanSchema = z.object({
  date: DateStringSchema,
  blocks: z.array(PlanBlockSchema).min(1),
  coachNote: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})
export type DayPlan = z.infer<typeof DayPlanSchema>

// ── Coach ───────────────────────────────────────────────────────────────────

export const CoachSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Evidence: factor keys or plan block ids this is based on. */
  basedOn: z.array(z.string().min(1)).min(1),
})
export type CoachSuggestion = z.infer<typeof CoachSuggestionSchema>

/** AI structured output — MUST be parsed with this schema before use. */
export const CoachReplySchema = z.object({
  message: z.string().min(1),
  /** Deliberately allowed to be empty — the coach may have nothing actionable. */
  suggestions: z.array(CoachSuggestionSchema),
  adjustedPlan: DayPlanSchema.optional(),
  /** Non-clinical disclaimer — must always be shown with coach output. */
  disclaimer: z.string().min(1),
})
export type CoachReply = z.infer<typeof CoachReplySchema>

// ── API error ───────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
