import { z } from 'zod'

/**
 * Akeso shared contract (Issue #6 — FROZEN once agreed).
 *
 * Single source of truth for the shapes exchanged between App, API, Domain
 * and AI. Every fixture, every API payload and every AI structured output
 * MUST parse against these schemas. Breaking changes require notifying all
 * affected module owners (see docs/TEAM_CONTRACT.md §2).
 */

/**
 * Re-exported so every consumer checks `instanceof ZodError` against the
 * class that actually throws. All runtime validators live in this package,
 * so this is the one ZodError class that matters; a workspace-wide npm
 * hoisting conflict (Expo's CLI pins zod v3) means each package gets its own
 * nested zod copy, so importing `zod` directly elsewhere would resolve to a
 * different physical class and break `instanceof` checks.
 */
export { ZodError } from 'zod'

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

/**
 * The regex alone accepts calendar nonsense like "2026-13-45" — this
 * round-trips the parsed components through Date.UTC and rejects anything
 * that doesn't come back out unchanged (e.g. day 30 rolling Feb into Mar).
 */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Local calendar date, YYYY-MM-DD. Rejects impossible dates like 2026-13-45. */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine(isRealCalendarDate, { message: 'Not a real calendar date' })
export type DateString = z.infer<typeof DateStringSchema>

/** Local wall-clock time, HH:mm, 24h. */
export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm (24h)')
export type TimeString = z.infer<typeof TimeStringSchema>

/** ISO 8601 datetime with timezone offset, e.g. 2026-07-21T08:05:00+10:00. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true })
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** IANA timezone identifier, e.g. "Australia/Sydney". */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: 'expected a valid IANA timezone identifier' })
export type TimeZone = z.infer<typeof TimeZoneSchema>

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

const FactorImpactSchema = z.number().int().min(-50).max(50)

export const EnergyFactorSchema = z.discriminatedUnion('role', [
  z
    .object({
      key: z.literal('reported_energy'),
      label: z.string().min(1),
      role: z.literal('reported_energy'),
      /** Signed integer points this factor contributed to the score. */
      impact: FactorImpactSchema,
      explanation: z.string().min(1),
    })
    .strict(),
  z
    .object({
      key: z.enum(['sleep_duration', 'last_meal', 'hydration']),
      label: z.string().min(1),
      role: z.literal('possible_context'),
      explanation: z.string().min(1),
    })
    .strict(),
])
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

export const PlanBlockStatusSchema = z.enum(['planned', 'completed'])
export type PlanBlockStatus = z.infer<typeof PlanBlockStatusSchema>

export const PlanBlockSourceSchema = z.enum(['akeso', 'user'])
export type PlanBlockSource = z.infer<typeof PlanBlockSourceSchema>

export const OriginalPlanBlockSuggestionSchema = z
  .object({
    title: z.string().min(1),
    start: TimeStringSchema,
    end: TimeStringSchema,
  })
  .strict()
export type OriginalPlanBlockSuggestion = z.infer<
  typeof OriginalPlanBlockSuggestionSchema
>

const PlanBlockFields = {
  id: z.string().min(1),
  start: TimeStringSchema,
  end: TimeStringSchema,
  type: PlanBlockTypeSchema,
  title: z.string().min(1),
  taskId: z.string().min(1).optional(),
  status: PlanBlockStatusSchema,
  /** Predicted energy band during this block. */
  energyLevel: EnergyBandSchema,
  /** Why the planner put it here — always evidence-based. */
  rationale: z.string().min(1),
} as const

export const PlanBlockSchema = z
  .discriminatedUnion('source', [
    z
      .object({
        ...PlanBlockFields,
        source: z.literal('akeso'),
        originalSuggestion: z.never().optional(),
      })
      .strict(),
    z
      .object({
        ...PlanBlockFields,
        source: z.literal('user'),
        originalSuggestion: OriginalPlanBlockSuggestionSchema,
      })
      .strict(),
  ])
  // Zero-padded HH:mm compares correctly as a string. Blocks stay within one
  // local day — overnight blocks are out of scope for the demo.
  .refine((b) => b.end > b.start, { message: 'end must be after start' })
export type PlanBlock = z.infer<typeof PlanBlockSchema>

export const UpdatePlanBlockInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    start: TimeStringSchema,
    end: TimeStringSchema,
    status: PlanBlockStatusSchema,
  })
  .strict()
  .refine((input) => input.end > input.start, {
    message: 'end must be after start',
  })
export type UpdatePlanBlockInput = z.infer<typeof UpdatePlanBlockInputSchema>

export const DayPlanSchema = z.object({
  date: DateStringSchema,
  blocks: z.array(PlanBlockSchema),
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

/**
 * Raw AI chat output before server-side grounding: suggestion ids are
 * assigned by the server, and every basedOn ref is validated against the
 * user's real energy factors / plan block ids before anything is shown.
 */
export const CoachChatSuggestionDraftSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Evidence refs — must be copied exactly from the allowed list in the prompt. */
  basedOn: z.array(z.string().min(1)).min(1),
})
export type CoachChatSuggestionDraft = z.infer<
  typeof CoachChatSuggestionDraftSchema
>

export const CoachChatBlueprintSchema = z.object({
  message: z.string().min(1),
  suggestions: z.array(CoachChatSuggestionDraftSchema).max(3),
})
export type CoachChatBlueprint = z.infer<typeof CoachChatBlueprintSchema>

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

// ── User & onboarding ───────────────────────────────────────────────────────

export const UserGoalSchema = z.enum(['academic', 'work', 'fitness', 'balance'])
export type UserGoal = z.infer<typeof UserGoalSchema>

export const DietaryPreferenceSchema = z.enum([
  'none',
  'vegetarian',
  'vegan',
  'halal',
  'gluten_free',
])
export type DietaryPreference = z.infer<typeof DietaryPreferenceSchema>

export const FoodAllergenSchema = z.enum([
  'peanuts',
  'tree_nuts',
  'milk',
  'eggs',
  'soy',
  'wheat_gluten',
  'fish',
  'shellfish',
  'sesame',
])
export type FoodAllergen = z.infer<typeof FoodAllergenSchema>

export const DietarySafetyProfileSchema = z
  .object({
    /** User-reported allergies Akeso must avoid when suggesting meals. */
    allergens: z.array(FoodAllergenSchema).max(12).default([]),
    /** Free-text foods or ingredients the user wants Akeso to avoid. */
    avoidIngredients: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    /** Optional clarification, e.g. "cross-contamination is okay/not okay". */
    notes: z.string().trim().max(280).optional(),
  })
  .strict()
export type DietarySafetyProfile = z.infer<typeof DietarySafetyProfileSchema>

export const UserProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  goal: UserGoalSchema,
  typicalWake: TimeStringSchema,
  typicalSleep: TimeStringSchema,
  dietaryPreference: DietaryPreferenceSchema,
  dietarySafety: DietarySafetyProfileSchema.default({
    allergens: [],
    avoidIngredients: [],
  }),
})
export type UserProfile = z.infer<typeof UserProfileSchema>

/**
 * The complete, deliberately small profile allowlist available to health-
 * report recommendation generation. Every value is an enum or validated time
 * string. Names, allergy notes, avoid lists, and every other free-text profile
 * field are excluded so they cannot become prompt instructions or UI copy.
 */
export const HealthRecommendationProfileContextSchema = z
  .object({
    goal: UserGoalSchema,
    typicalWake: TimeStringSchema,
    typicalSleep: TimeStringSchema,
    dietaryPreference: DietaryPreferenceSchema,
  })
  .strict()
export type HealthRecommendationProfileContext = z.infer<
  typeof HealthRecommendationProfileContextSchema
>

// ── Nutrition ───────────────────────────────────────────────────────────────

export const NutrientKeySchema = z.enum([
  'protein',
  'complex_carbs',
  'iron',
  'vitamin_c',
  'omega3',
  'hydration',
  'fiber',
])
export type NutrientKey = z.infer<typeof NutrientKeySchema>

export const NutrientNeedSchema = z.object({
  key: NutrientKeySchema,
  label: z.string().min(1),
  current: z.number().min(0),
  target: z.number().positive(),
  unit: z.string().min(1),
  note: z.string().optional(),
})
export type NutrientNeed = z.infer<typeof NutrientNeedSchema>

export const FridgeCategorySchema = z.enum([
  'protein',
  'vegetable',
  'fruit',
  'dairy',
  'grain',
  'other',
])
export type FridgeCategory = z.infer<typeof FridgeCategorySchema>

export const FridgeItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  category: FridgeCategorySchema,
  allergenTags: z.array(FoodAllergenSchema).default([]),
})
export type FridgeItem = z.infer<typeof FridgeItemSchema>

/**
 * Presence-only ingredient returned by a vision provider.
 *
 * Quantity, unit, weight and expiry intentionally do not belong in this
 * contract: a recognition only claims that the ingredient is visible. The
 * user confirms and edits these candidates before anything reaches inventory.
 */
export const DetectedIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: FridgeCategorySchema,
    confidence: z.number().min(0).max(1),
    uncertaintyReason: z.string().trim().min(1).max(280).nullable(),
  })
  .strict()
export type DetectedIngredient = z.infer<typeof DetectedIngredientSchema>

const RecognizedIngredientsSchema = z.array(DetectedIngredientSchema)

/**
 * AI structured output for fridge-photo recognition.
 *
 * Empty and refused outcomes must carry an empty ingredient list so callers
 * never have to guess whether a provider-generated item is real.
 */
export const IngredientRecognitionResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ok'),
      ingredients: RecognizedIngredientsSchema.min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal('empty'),
      ingredients: RecognizedIngredientsSchema.length(0),
      reason: z.enum(['no_food_detected', 'unrecognizable_image']),
    })
    .strict(),
  z
    .object({
      status: z.literal('refused'),
      ingredients: RecognizedIngredientsSchema.length(0),
      reason: z.string().trim().min(1).max(280),
    })
    .strict(),
])
export type IngredientRecognitionResult = z.infer<
  typeof IngredientRecognitionResultSchema
>

export const MealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
export type MealSlot = z.infer<typeof MealSlotSchema>

export const MealRecommendationSchema = z.object({
  id: z.string().min(1),
  slot: MealSlotSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  /** References NutritionPlan.fridge[].id within the same response. */
  usesFridgeItemIds: z.array(z.string().min(1)),
  /** User-facing safety tags; meals matching the user's allergens are filtered out. */
  allergenTags: z.array(FoodAllergenSchema).default([]),
  boosts: z.array(NutrientKeySchema),
  prepMinutes: z.number().int().positive(),
  tags: z.array(z.string().min(1)),
})
export type MealRecommendation = z.infer<typeof MealRecommendationSchema>

export const NutritionPlanSchema = z
  .object({
    date: DateStringSchema,
    needs: z.array(NutrientNeedSchema),
    fridge: z.array(FridgeItemSchema),
    meals: z.array(MealRecommendationSchema),
    /** Ties recommendations back to today's energy factors. */
    rationale: z.string().min(1),
  })
  .superRefine((plan, context) => {
    const fridgeIds = new Set(plan.fridge.map((item) => item.id))
    plan.meals.forEach((meal, mealIndex) => {
      meal.usesFridgeItemIds.forEach((itemId, itemIndex) => {
        if (!fridgeIds.has(itemId)) {
          context.addIssue({
            code: 'custom',
            path: ['meals', mealIndex, 'usesFridgeItemIds', itemIndex],
            message: `Unknown fridge item id: ${itemId}`,
          })
        }
      })
    })
  })
export type NutritionPlan = z.infer<typeof NutritionPlanSchema>

// ── Health reports ────────────────────────────────────────────────────────

/**
 * Status of a single metric relative to the reference range printed on the
 * report itself. `unknown` is used whenever the report did not supply a
 * usable bound for the comparison — a status is never invented from
 * population defaults or model guesses.
 */
export const ReportMetricStatusSchema = z.enum(['low', 'normal', 'high', 'unknown'])
export type ReportMetricStatus = z.infer<typeof ReportMetricStatusSchema>

/**
 * A metric the user has reviewed and confirmed from an uploaded report.
 * `referenceLow` / `referenceHigh` come from the report and either may be
 * absent. `status` is derived (see computeMetricStatus in @akeso/domain) from
 * the value against those bounds and MUST be `unknown` whenever a bound
 * needed for the comparison is missing. Units are display-only: comparisons
 * only ever use the report's own value and range, never a converted number.
 */
export const ReportMetricSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    value: z.number().finite(),
    /** e.g. "g/dL". Empty is allowed for unitless metrics (ratios, pH). */
    unit: z.string().trim().max(30),
    referenceLow: z.number().finite().nullable(),
    referenceHigh: z.number().finite().nullable(),
    status: ReportMetricStatusSchema,
    /** Recognition confidence is retained so saved reports remain reviewable. */
    confidence: z.number().min(0).max(1).nullable().default(null),
    /** Human-readable extraction uncertainty; never used to derive status. */
    uncertaintyReason: z.string().trim().min(1).max(280).nullable().default(null),
    /** Only confirmed metrics may ground recommendations. */
    confirmed: z.boolean().default(true),
  })
  .strict()
  .superRefine((metric, context) => {
    if (
      metric.referenceLow !== null &&
      metric.referenceHigh !== null &&
      metric.referenceLow > metric.referenceHigh
    ) {
      context.addIssue({
        code: 'custom',
        path: ['referenceHigh'],
        message: 'Reference high must be greater than or equal to reference low',
      })
    }
  })
export type ReportMetric = z.infer<typeof ReportMetricSchema>

/**
 * A single metric read off a report image by the extraction model.
 *
 * Deliberately has no `id` and no `status`: the id is assigned when the user
 * confirms the metric, and the status is computed server-side from the
 * value/range so the model can never assert "high"/"low" on its own. The
 * user reviews and edits these candidates before anything is persisted.
 */
export const DetectedReportMetricSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    value: z.number().finite(),
    unit: z.string().trim().max(30),
    referenceLow: z.number().finite().nullable(),
    referenceHigh: z.number().finite().nullable(),
    confidence: z.number().min(0).max(1),
    uncertaintyReason: z.string().trim().min(1).max(280).nullable(),
  })
  .strict()
export type DetectedReportMetric = z.infer<typeof DetectedReportMetricSchema>

const DetectedReportMetricsSchema = z.array(DetectedReportMetricSchema)

/**
 * AI structured output for report-image metric extraction.
 *
 * Empty and refused outcomes carry an empty metric list so callers never
 * have to guess whether a model-generated metric is real.
 */
export const ReportExtractionResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ok'),
      metrics: DetectedReportMetricsSchema.min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal('empty'),
      metrics: DetectedReportMetricsSchema.length(0),
      reason: z.enum(['no_metrics_detected', 'unrecognizable_image']),
    })
    .strict(),
  z
    .object({
      status: z.literal('refused'),
      metrics: DetectedReportMetricsSchema.length(0),
      reason: z.string().trim().min(1).max(280),
    })
    .strict(),
])
export type ReportExtractionResult = z.infer<typeof ReportExtractionResultSchema>

export const ReportNameSchema = z.string().trim().min(1).max(120)
export type ReportName = z.infer<typeof ReportNameSchema>

export const HealthReportSchema = z
  .object({
    id: z.string().min(1),
    /** User-editable report or laboratory name. */
    name: ReportNameSchema.default('Health report'),
    /** Date printed on the report; null when the source did not provide one. */
    reportDate: DateStringSchema.nullable().default(null),
    /** Upload/save timestamp, assigned by the server and never client-editable. */
    createdAt: IsoDateTimeSchema,
    /** Includes both confirmed and still-unconfirmed recognition results. */
    metrics: z.array(ReportMetricSchema).min(1),
  })
  .superRefine((report, context) => {
    if (!report.metrics.some((metric) => metric.confirmed)) {
      context.addIssue({
        code: 'custom',
        path: ['metrics'],
        message: 'At least one report metric must be confirmed',
      })
    }
  })
export type HealthReport = z.infer<typeof HealthReportSchema>

export const HealthRecommendationCategorySchema = z.enum([
  'nutrition',
  'activity',
  'sleep',
  'hydration',
  'stress',
  'follow_up',
  'general',
])
export type HealthRecommendationCategory = z.infer<
  typeof HealthRecommendationCategorySchema
>

export const HealthRecommendationSchema = z.object({
  id: z.string().min(1),
  category: HealthRecommendationCategorySchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Confirmed metric ids this suggestion is grounded in — never empty. */
  basedOnMetricIds: z
    .array(z.string().min(1))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Recommendation metric ids must be unique',
    }),
})
export type HealthRecommendation = z.infer<typeof HealthRecommendationSchema>

/**
 * AI structured output for safe, non-diagnostic lifestyle recommendations.
 *
 * `metrics` echoes the confirmed metrics the set was grounded in; the
 * superRefine rejects any recommendation citing a metric id outside that set
 * (mirrors NutritionPlan's fridge-id check). The server substitutes its own
 * confirmed metrics for `metrics` and re-validates, so a recommendation
 * referencing a metric the user never confirmed is rejected server-side
 * rather than surfacing to the client as a real citation.
 */
export const HealthRecommendationSetSchema = z
  .object({
    reportId: z.string().min(1),
    metrics: z.array(ReportMetricSchema),
    recommendations: z.array(HealthRecommendationSchema),
    /** Non-diagnostic disclaimer — MUST always be shown with recommendations. */
    disclaimer: z.string().min(1),
  })
  .superRefine((set, context) => {
    const metricIds = new Set(set.metrics.map((metric) => metric.id))
    if (metricIds.size !== set.metrics.length) {
      context.addIssue({
        code: 'custom',
        path: ['metrics'],
        message: 'Recommendation evidence metric ids must be unique',
      })
    }
    set.recommendations.forEach((recommendation, recommendationIndex) => {
      recommendation.basedOnMetricIds.forEach((metricId, metricIdIndex) => {
        if (!metricIds.has(metricId)) {
          context.addIssue({
            code: 'custom',
            path: [
              'recommendations',
              recommendationIndex,
              'basedOnMetricIds',
              metricIdIndex,
            ],
            message: `Unknown metric id: ${metricId}`,
          })
        }
      })
    })
  })
export type HealthRecommendationSet = z.infer<typeof HealthRecommendationSetSchema>

/**
 * Closed set of safe recommendation actions.
 *
 * The AI recommendation path returns ONLY these codes plus confirmed metric
 * ids — never user-visible prose. The server renders every title/detail from a
 * fixed trusted template keyed by the code (see @akeso/domain report
 * templates), so a compromised or prompt-injected provider can never place
 * free text — diagnostic, prescriptive, or otherwise — in front of the user.
 * The codes deliberately cover only general lifestyle support and professional
 * follow-up: there is no code that renders a diagnosis or a medication
 * instruction, so a low/high/unknown metric cannot produce such text either.
 */
export const RecommendationActionCodeSchema = z.enum([
  'professional_follow_up',
  'support_sleep',
  'support_hydration',
  'support_balanced_meals',
  'support_gentle_movement',
  'support_stress',
  'general_wellbeing',
])
export type RecommendationActionCode = z.infer<typeof RecommendationActionCodeSchema>

export const HealthRecommendationBlueprintItemSchema = z
  .object({
    actionCode: RecommendationActionCodeSchema,
    /** Confirmed metric ids this action is grounded in — validated server-side. */
    basedOnMetricIds: z.array(z.string().min(1)).min(1),
  })
  .strict()
export type HealthRecommendationBlueprintItem = z.infer<
  typeof HealthRecommendationBlueprintItemSchema
>

/**
 * Text-free AI output for report recommendations: action codes plus confirmed
 * metric ids only. Carries no reportId, metrics, titles, details, or
 * disclaimer — the server supplies all of those from the persisted confirmed
 * report and fixed templates when rendering the HealthRecommendationSet.
 */
export const HealthRecommendationBlueprintSchema = z
  .object({
    recommendations: z.array(HealthRecommendationBlueprintItemSchema),
  })
  .strict()
export type HealthRecommendationBlueprint = z.infer<
  typeof HealthRecommendationBlueprintSchema
>

// ── Reminders ───────────────────────────────────────────────────────────────

export const ReminderPreferenceSchema = z.object({
  enabled: z.boolean(),
  /** Local time, HH:mm, 24h — when to send the daily check-in reminder. */
  checkInTime: TimeStringSchema,
  /**
   * IANA timezone the reminder time is interpreted in, e.g. "Australia/Sydney".
   * Phase 1 (on-device notifications) doesn't need this — the device's own
   * clock handles DST — but a future server-side push scheduler will need to
   * know which timezone `checkInTime` was set in, so it's captured now rather
   * than requiring a data migration later.
   */
  timezone: TimeZoneSchema,
})
export type ReminderPreference = z.infer<typeof ReminderPreferenceSchema>

// ── API error ───────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
