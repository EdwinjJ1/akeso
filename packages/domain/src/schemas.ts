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

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a local date as YYYY-MM-DD')

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

export const caffeineIntakeSchema = z.enum([
  'none',
  'morning',
  'afternoon',
  'evening',
])

export const checkInInputSchema = z.object({
  date: localDateSchema,
  sleepHours: z
    .number()
    .min(0)
    .max(14)
    .refine((hours) => Number.isInteger(hours * 2), {
      message: 'sleepHours must be in 0.5-hour steps',
    }),
  sleepQuality: scale1to5Schema,
  mood: scale1to5Schema,
  stress: scale1to5Schema,
  energyNow: scale1to5Schema,
  caffeine: caffeineIntakeSchema,
  notes: z.string().max(280).optional(),
})

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
