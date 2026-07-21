import { z } from 'zod'

/**
 * Re-exported so every consumer checks `instanceof ZodError` against the
 * same class reference. A workspace-wide npm hoisting conflict (Expo's CLI
 * pins zod v3, so this v4 install gets its own nested copy per workspace
 * package) means importing `zod` directly from another package would
 * resolve to a different physical copy and break `instanceof` checks.
 */
export { ZodError } from 'zod'

/**
 * Runtime validators for every shape that crosses a process boundary
 * (HTTP body, query string). Kept in lockstep with types.ts by hand —
 * this is the one file where a mismatch would silently break the
 * "App and API share one contract" guarantee.
 */

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

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a local date as YYYY-MM-DD')
  .refine(isRealCalendarDate, { message: 'Not a real calendar date' })

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24h time as HH:mm')

export const scale1to5Schema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export const sleepDurationSchema = z.enum([
  'under_5h',
  '5_6h',
  '6_7h',
  '7_8h',
  '8_9h',
  'over_9h',
  'not_sure',
])

export const lastMealTimingSchema = z.enum([
  'within_1h',
  '1_3h',
  '3_5h',
  'over_5h',
  'not_today',
  'not_sure',
])

export const hydrationSchema = z.enum([
  'under_0_5l',
  '0_5_1l',
  '1_1_5l',
  '1_5_2l',
  'over_2l',
  'not_sure',
])

export const checkInInputSchema = z
  .object({
    date: localDateSchema,
    reportedEnergy: scale1to5Schema,
    sleepDuration: sleepDurationSchema,
    lastMealTiming: lastMealTimingSchema,
    lastMealDescription: z.string().max(280).optional(),
    hydration: hydrationSchema,
  })
  // Reject unknown keys rather than silently dropping them, so a stale UI
  // still sending legacy fields (sleepHours, caffeine, …) fails loudly during
  // the contract migration instead of posting a half-empty check-in.
  .strict()

export const userGoalSchema = z.enum(['academic', 'work', 'fitness', 'balance'])

export const dietaryPreferenceSchema = z.enum([
  'none',
  'vegetarian',
  'vegan',
  'halal',
  'gluten_free',
])

export const userProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  goal: userGoalSchema,
  typicalWake: hhmmSchema,
  typicalSleep: hhmmSchema,
  dietaryPreference: dietaryPreferenceSchema,
})

export const regeneratePlanBodySchema = z.object({
  instruction: z.string().max(280).optional(),
})
