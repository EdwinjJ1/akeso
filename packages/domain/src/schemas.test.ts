import { describe, expect, test } from 'vitest'

import { fixtureProfile } from './fixtures'
import {
  checkInInputSchema,
  localDateSchema,
  regeneratePlanBodySchema,
  userProfileSchema,
} from './schemas'

const validCheckIn = {
  date: '2026-07-21',
  reportedEnergy: 3,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

describe('checkInInputSchema', () => {
  test('accepts a well-formed check-in', () => {
    expect(checkInInputSchema.safeParse(validCheckIn).success).toBe(true)
  })

  test('accepts an optional lastMealDescription field', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      lastMealDescription: 'Leftover salmon rice bowl',
    })
    expect(result.success).toBe(true)
  })

  test('rejects a malformed date', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      date: '21-07-2026',
    })
    expect(result.success).toBe(false)
  })

  test('rejects an out-of-range reportedEnergy value', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      reportedEnergy: 6,
    })
    expect(result.success).toBe(false)
  })

  test('rejects an unknown sleepDuration bucket', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      sleepDuration: '9h',
    })
    expect(result.success).toBe(false)
  })

  test('rejects an unknown lastMealTiming bucket', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      lastMealTiming: 'yesterday',
    })
    expect(result.success).toBe(false)
  })

  test('rejects an unknown hydration bucket', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      hydration: 'lots',
    })
    expect(result.success).toBe(false)
  })

  test('rejects a leftover legacy field instead of silently dropping it', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      sleepHours: 7.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('userProfileSchema', () => {
  test('accepts the shared demo fixture', () => {
    expect(userProfileSchema.safeParse(fixtureProfile).success).toBe(true)
  })

  test('rejects a malformed time string', () => {
    const result = userProfileSchema.safeParse({
      ...fixtureProfile,
      typicalWake: '7:30am',
    })
    expect(result.success).toBe(false)
  })

  test('rejects an unknown food allergen', () => {
    const result = userProfileSchema.safeParse({
      ...fixtureProfile,
      dietarySafety: {
        allergens: ['dragonfruit'],
        avoidIngredients: [],
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('localDateSchema', () => {
  test('accepts a real date', () => {
    expect(localDateSchema.safeParse('2026-07-21').success).toBe(true)
  })

  test('accepts a real leap day', () => {
    expect(localDateSchema.safeParse('2024-02-29').success).toBe(true)
  })

  test('rejects a non-leap-year Feb 29', () => {
    expect(localDateSchema.safeParse('2026-02-29').success).toBe(false)
  })

  test('rejects an out-of-range month', () => {
    expect(localDateSchema.safeParse('2026-13-01').success).toBe(false)
  })

  test('rejects an out-of-range day', () => {
    expect(localDateSchema.safeParse('2026-02-30').success).toBe(false)
  })

  test('rejects the regex-matching but calendar-invalid "2026-13-45"', () => {
    expect(localDateSchema.safeParse('2026-13-45').success).toBe(false)
  })
})

describe('regeneratePlanBodySchema', () => {
  test('accepts an empty body', () => {
    expect(regeneratePlanBodySchema.safeParse({}).success).toBe(true)
  })

  test('accepts a free-text instruction', () => {
    expect(
      regeneratePlanBodySchema.safeParse({ instruction: 'more rest' }).success
    ).toBe(true)
  })
})
