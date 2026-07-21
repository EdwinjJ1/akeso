import { z } from 'zod'
import {
  ApiErrorSchema,
  CheckInInputSchema,
  CoachReplySchema,
  DateStringSchema,
  DayPlanSchema,
  EnergyResultSchema,
  NutritionPlanSchema,
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
} as const
