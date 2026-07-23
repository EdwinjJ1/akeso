import { z } from 'zod'
import {
  ApiErrorSchema,
  CheckInInputSchema,
  CoachReplySchema,
  DateStringSchema,
  DayPlanSchema,
  EnergyResultSchema,
  FridgeItemSchema,
  HealthReportSchema,
  HealthRecommendationSetSchema,
  IngredientRecognitionResultSchema,
  NutritionPlanSchema,
  ReminderPreferenceSchema,
  ReportNameSchema,
  ReportExtractionResultSchema,
  ReportMetricSchema,
  TaskSchema,
  UpdatePlanBlockInputSchema,
  UserProfileSchema,
  type ApiError,
} from './schemas'

/**
 * HTTP contract between App and API (Issue #6 — FROZEN once agreed).
 *
 * Every response travels in the `ApiResponse` envelope produced by the API's
 * `ok()` / `fail()` helpers: `{ success: true, data }` on success,
 * `{ success: false, error }` on failure.
 */

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data: dataSchema }),
    z.object({ success: z.literal(false), error: ApiErrorSchema }),
  ])
}

/** Path params for every date-scoped `/v1` route (`:date` = YYYY-MM-DD). */
export const DateParamsSchema = z.object({ date: DateStringSchema })
export type DateParams = z.infer<typeof DateParamsSchema>

// ── GET /v1/profile · PUT /v1/profile ───────────────────────────────────────

/** `data: null` until onboarding has saved a profile. */
export const GetProfileResponseSchema = apiResponseSchema(
  UserProfileSchema.nullable()
)
export const PutProfileRequestSchema = UserProfileSchema
export const PutProfileResponseSchema = apiResponseSchema(UserProfileSchema)

// ── POST /v1/checkins ───────────────────────────────────────────────────────

export const CheckInRequestSchema = CheckInInputSchema
export const CheckInResponseSchema = apiResponseSchema(EnergyResultSchema)
export type CheckInResponse = ApiResponse<z.infer<typeof EnergyResultSchema>>

// ── GET /v1/energy/:date ────────────────────────────────────────────────────

/** `data: null` (HTTP 200) when there is no check-in for that date yet. */
export const GetEnergyResponseSchema = apiResponseSchema(
  EnergyResultSchema.nullable()
)

// ── GET /v1/tasks?date= ─────────────────────────────────────────────────────

export const TasksQuerySchema = z.object({ date: DateStringSchema })
export type TasksQuery = z.infer<typeof TasksQuerySchema>

export const TasksResponseSchema = apiResponseSchema(z.array(TaskSchema))

// ── GET /v1/plan/:date ──────────────────────────────────────────────────────

/** `data: null` (HTTP 200) when no plan exists for that date yet. */
export const GetPlanResponseSchema = apiResponseSchema(DayPlanSchema.nullable())

// ── PATCH /v1/plan/:date/blocks/:blockId ───────────────────────────────────

export const UpdatePlanBlockParamsSchema = DateParamsSchema.extend({
  blockId: z.string().min(1),
})
export type UpdatePlanBlockParams = z.infer<typeof UpdatePlanBlockParamsSchema>

export const UpdatePlanBlockRequestSchema = UpdatePlanBlockInputSchema
export const UpdatePlanBlockResponseSchema = apiResponseSchema(DayPlanSchema)

// ── POST /v1/plan/:date/regenerate ──────────────────────────────────────────

export const RegeneratePlanBodySchema = z.object({
  instruction: z.string().max(280).optional(),
})
export type RegeneratePlanBody = z.infer<typeof RegeneratePlanBodySchema>

export const RegeneratePlanResponseSchema = apiResponseSchema(
  z.object({ plan: DayPlanSchema, coach: CoachReplySchema })
)

// ── GET /v1/nutrition/:date ─────────────────────────────────────────────────

/** `data: null` (HTTP 200) when no nutrition plan exists for that date yet. */
export const GetNutritionResponseSchema = apiResponseSchema(
  NutritionPlanSchema.nullable()
)

// ── GET /v1/coach/:date ─────────────────────────────────────────────────────

export const GetCoachResponseSchema = apiResponseSchema(CoachReplySchema)

// ── GET /v1/fridge · PUT /v1/fridge/:id · DELETE /v1/fridge/:id ─────────────

export const FridgeItemParamsSchema = z.object({ id: z.string().min(1) })
export type FridgeItemParams = z.infer<typeof FridgeItemParamsSchema>

export const GetFridgeResponseSchema = apiResponseSchema(z.array(FridgeItemSchema))

/** `id` comes from the path, not the body — a PUT is always "upsert this id". */
export const PutFridgeItemBodySchema = FridgeItemSchema.omit({ id: true })
export type PutFridgeItemBody = z.infer<typeof PutFridgeItemBodySchema>
export const PutFridgeItemResponseSchema = apiResponseSchema(FridgeItemSchema)

export const PostFridgeItemRequestSchema = FridgeItemSchema
export const PatchFridgeItemBodySchema = PutFridgeItemBodySchema.partial().refine(
  (body) => body.name !== undefined || body.category !== undefined,
  { message: 'At least one field is required' }
)

export const DeleteFridgeItemResponseSchema = apiResponseSchema(z.null())

// ── POST /v1/fridge-items/batch ──────────────────────────────────────────────

/** The client sends only candidates the user explicitly confirmed. */
export const BatchFridgeItemsRequestSchema = z
  .object({ items: z.array(FridgeItemSchema).max(50) })
  .strict()
export type BatchFridgeItemsRequest = z.infer<
  typeof BatchFridgeItemsRequestSchema
>
export const BatchFridgeItemsResponseSchema = apiResponseSchema(
  z.array(FridgeItemSchema)
)

// ── POST /v1/fridge/recognitions (multipart image) ──────────────────────────

export const CreateFridgeRecognitionResponseSchema = apiResponseSchema(
  IngredientRecognitionResultSchema
)

// ── POST /v1/nutrition/:date/regenerate ────────────────────────────────────────

export const RegenerateNutritionResponseSchema = apiResponseSchema(
  NutritionPlanSchema
)

// ── Health reports ──────────────────────────────────────────────────────────

export const ReportParamsSchema = z.object({ id: z.string().min(1) })
export type ReportParams = z.infer<typeof ReportParamsSchema>

/** POST /v1/reports/extractions (multipart image) — never persists anything. */
export const CreateReportExtractionResponseSchema = apiResponseSchema(
  ReportExtractionResultSchema
)

/** GET /v1/reports */
export const GetReportsResponseSchema = apiResponseSchema(
  z.array(HealthReportSchema)
)

const reportMetricsInputSchema = z
  .array(ReportMetricSchema)
  .min(1)
  .max(50)
  .superRefine((metrics, context) => {
    if (!metrics.some((metric) => metric.confirmed)) {
      context.addIssue({
        code: 'custom',
        message: 'At least one report metric must be confirmed',
      })
    }
    const ids = new Set<string>()
    const names = new Set<string>()
    metrics.forEach((metric, index) => {
      const normalizedName = metric.name.trim().toLocaleLowerCase()
      if (ids.has(metric.id)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: 'Report metric ids must be unique',
        })
      }
      if (names.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'name'],
          message: 'Report metric names must be unique',
        })
      }
      ids.add(metric.id)
      names.add(normalizedName)
    })
  })

/**
 * POST /v1/reports — stores every reviewed recognition result so low
 * confidence and unconfirmed fields remain visible after save. At least one
 * metric must be explicitly confirmed before a report can be persisted.
 */
export const CreateReportRequestSchema = z
  .object({
    name: ReportNameSchema.default('Health report'),
    reportDate: DateStringSchema.nullable().default(null),
    metrics: reportMetricsInputSchema,
  })
  .strict()
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>
export const CreateReportResponseSchema = apiResponseSchema(HealthReportSchema)

/** GET /v1/reports/:id */
export const GetReportResponseSchema = apiResponseSchema(HealthReportSchema)

/** PATCH /v1/reports/:id — metadata only; upload time is immutable. */
export const UpdateReportRequestSchema = z
  .object({
    name: ReportNameSchema.optional(),
    reportDate: DateStringSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (body) => body.name !== undefined || body.reportDate !== undefined,
    { message: 'At least one report field is required' }
  )
export type UpdateReportRequest = z.infer<typeof UpdateReportRequestSchema>
export const UpdateReportResponseSchema = apiResponseSchema(HealthReportSchema)

/** PATCH /v1/reports/:id/metrics — complete reviewed metric replacement. */
export const UpdateReportMetricsRequestSchema = z
  .object({ metrics: reportMetricsInputSchema })
  .strict()
export type UpdateReportMetricsRequest = z.infer<
  typeof UpdateReportMetricsRequestSchema
>
export const UpdateReportMetricsResponseSchema = apiResponseSchema(
  HealthReportSchema
)

/** DELETE /v1/reports/:id */
export const DeleteReportResponseSchema = apiResponseSchema(z.null())

/** GET /v1/reports/:id/recommendations — a safe fallback set when none cached. */
export const GetReportRecommendationsResponseSchema = apiResponseSchema(
  HealthRecommendationSetSchema
)

/** POST /v1/reports/:id/recommendations/regenerate (the AI-calling path). */
export const RegenerateReportRecommendationsResponseSchema = apiResponseSchema(
  HealthRecommendationSetSchema
)

// ── GET /v1/reminders · PUT /v1/reminders ───────────────────────────────────

/** `data: null` until the user has set a preference. */
export const GetReminderResponseSchema = apiResponseSchema(
  ReminderPreferenceSchema.nullable()
)
export const PutReminderRequestSchema = ReminderPreferenceSchema
export const PutReminderResponseSchema = apiResponseSchema(ReminderPreferenceSchema)

// ── Route map ───────────────────────────────────────────────────────────────

/**
 * Route map of the implemented `/v1` API. Keys mirror the `AkesoService`
 * methods (packages/domain/src/service.ts) 1:1; paths, methods and shapes
 * must stay in lockstep with docs/API_CONTRACT.md and apps/api/src/routes/*.
 * apps/api/src/contract-conformance.test.ts checks real responses against
 * the response schemas referenced here.
 */
export const apiContract = {
  getProfile: {
    method: 'GET',
    path: '/v1/profile',
    response: GetProfileResponseSchema,
  },
  saveProfile: {
    method: 'PUT',
    path: '/v1/profile',
    request: PutProfileRequestSchema,
    response: PutProfileResponseSchema,
  },
  submitCheckIn: {
    method: 'POST',
    path: '/v1/checkins',
    request: CheckInRequestSchema,
    response: CheckInResponseSchema,
  },
  getTodayEnergy: {
    method: 'GET',
    path: '/v1/energy/:date',
    params: DateParamsSchema,
    response: GetEnergyResponseSchema,
  },
  getTasks: {
    method: 'GET',
    path: '/v1/tasks',
    query: TasksQuerySchema,
    response: TasksResponseSchema,
  },
  getTodayPlan: {
    method: 'GET',
    path: '/v1/plan/:date',
    params: DateParamsSchema,
    response: GetPlanResponseSchema,
  },
  updatePlanBlock: {
    method: 'PATCH',
    path: '/v1/plan/:date/blocks/:blockId',
    params: UpdatePlanBlockParamsSchema,
    request: UpdatePlanBlockRequestSchema,
    response: UpdatePlanBlockResponseSchema,
  },
  regeneratePlan: {
    method: 'POST',
    path: '/v1/plan/:date/regenerate',
    params: DateParamsSchema,
    request: RegeneratePlanBodySchema,
    response: RegeneratePlanResponseSchema,
  },
  getNutritionPlan: {
    method: 'GET',
    path: '/v1/nutrition/:date',
    params: DateParamsSchema,
    response: GetNutritionResponseSchema,
  },
  getCoachReply: {
    method: 'GET',
    path: '/v1/coach/:date',
    params: DateParamsSchema,
    response: GetCoachResponseSchema,
  },
  getFridgeItems: {
    method: 'GET',
    path: '/v1/fridge',
    response: GetFridgeResponseSchema,
  },
  saveFridgeItem: {
    method: 'PUT',
    path: '/v1/fridge/:id',
    params: FridgeItemParamsSchema,
    request: PutFridgeItemBodySchema,
    response: PutFridgeItemResponseSchema,
  },
  deleteFridgeItem: {
    method: 'DELETE',
    path: '/v1/fridge/:id',
    params: FridgeItemParamsSchema,
    response: DeleteFridgeItemResponseSchema,
  },
  saveFridgeItemsBatch: {
    method: 'POST',
    path: '/v1/fridge-items/batch',
    request: BatchFridgeItemsRequestSchema,
    response: BatchFridgeItemsResponseSchema,
  },
  recognizeFridgeImage: {
    method: 'POST',
    path: '/v1/fridge/recognitions',
    response: CreateFridgeRecognitionResponseSchema,
  },
  regenerateNutrition: {
    method: 'POST',
    path: '/v1/nutrition/:date/regenerate',
    params: DateParamsSchema,
    response: RegenerateNutritionResponseSchema,
  },
  createReportExtraction: {
    method: 'POST',
    path: '/v1/reports/extractions',
    response: CreateReportExtractionResponseSchema,
  },
  getReports: {
    method: 'GET',
    path: '/v1/reports',
    response: GetReportsResponseSchema,
  },
  createReport: {
    method: 'POST',
    path: '/v1/reports',
    request: CreateReportRequestSchema,
    response: CreateReportResponseSchema,
  },
  getReport: {
    method: 'GET',
    path: '/v1/reports/:id',
    params: ReportParamsSchema,
    response: GetReportResponseSchema,
  },
  updateReport: {
    method: 'PATCH',
    path: '/v1/reports/:id',
    params: ReportParamsSchema,
    request: UpdateReportRequestSchema,
    response: UpdateReportResponseSchema,
  },
  updateReportMetrics: {
    method: 'PATCH',
    path: '/v1/reports/:id/metrics',
    params: ReportParamsSchema,
    request: UpdateReportMetricsRequestSchema,
    response: UpdateReportMetricsResponseSchema,
  },
  deleteReport: {
    method: 'DELETE',
    path: '/v1/reports/:id',
    params: ReportParamsSchema,
    response: DeleteReportResponseSchema,
  },
  getReportRecommendations: {
    method: 'GET',
    path: '/v1/reports/:id/recommendations',
    params: ReportParamsSchema,
    response: GetReportRecommendationsResponseSchema,
  },
  regenerateReportRecommendations: {
    method: 'POST',
    path: '/v1/reports/:id/recommendations/regenerate',
    params: ReportParamsSchema,
    response: RegenerateReportRecommendationsResponseSchema,
  },
  getReminderPreference: {
    method: 'GET',
    path: '/v1/reminders',
    response: GetReminderResponseSchema,
  },
  saveReminderPreference: {
    method: 'PUT',
    path: '/v1/reminders',
    request: PutReminderRequestSchema,
    response: PutReminderResponseSchema,
  },
} as const
