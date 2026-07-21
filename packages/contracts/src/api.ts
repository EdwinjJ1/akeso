import { z } from 'zod'
import {
  ApiErrorSchema,
  CheckInInputSchema,
  CoachReplySchema,
  DateStringSchema,
  DayPlanSchema,
  EnergyResultSchema,
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

// ── POST /checkin ───────────────────────────────────────────────────────────

export const CheckInRequestSchema = CheckInInputSchema
export const CheckInResponseSchema = apiResponseSchema(EnergyResultSchema)
export type CheckInResponse = ApiResponse<z.infer<typeof EnergyResultSchema>>

// ── GET /plan ───────────────────────────────────────────────────────────────

export const PlanQuerySchema = z.object({
  /** Defaults to today (server-local) when omitted. */
  date: DateStringSchema.optional(),
})
export type PlanQuery = z.infer<typeof PlanQuerySchema>

export const PlanResponseSchema = apiResponseSchema(DayPlanSchema)
export type PlanResponse = ApiResponse<z.infer<typeof DayPlanSchema>>

// ── POST /coach ─────────────────────────────────────────────────────────────

export const CoachRequestSchema = z.object({
  /** The user's free-text message to the coach. */
  message: z.string().min(1).max(2000),
  /** Day the question refers to; defaults to today when omitted. */
  date: DateStringSchema.optional(),
})
export type CoachRequest = z.infer<typeof CoachRequestSchema>

export const CoachResponseSchema = apiResponseSchema(CoachReplySchema)
export type CoachResponse = ApiResponse<z.infer<typeof CoachReplySchema>>

// ── Route map ───────────────────────────────────────────────────────────────

/**
 * TARGET-STATE route map (Issue #6 口径, 3 端点). The implemented API
 * currently exposes 9 `/v1/*` endpoints with different paths/methods (see
 * docs/API_CONTRACT.md) — do not send requests against this route map as-is.
 * The data shapes in schemas.ts are authoritative for both; only the route
 * surface (path/method count) is unreconciled. See PR #28 for the tracked
 * decision.
 */
export const apiContract = {
  checkIn: {
    method: 'POST',
    path: '/checkin',
    request: CheckInRequestSchema,
    response: CheckInResponseSchema,
  },
  getPlan: {
    method: 'GET',
    path: '/plan',
    query: PlanQuerySchema,
    response: PlanResponseSchema,
  },
  coach: {
    method: 'POST',
    path: '/coach',
    request: CoachRequestSchema,
    response: CoachResponseSchema,
  },
} as const
