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
  sleepHours: 7.5,
  sleepQuality: 4,
  mood: 4,
  stress: 4,
  energyNow: 3,
  caffeine: 'afternoon',
}

describe('checkInInputSchema', () => {
  test('accepts a well-formed check-in', () => {
    expect(checkInInputSchema.safeParse(validCheckIn).success).toBe(true)
  })

  test('accepts an optional notes field', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      notes: 'Big deadline today',
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

  test('rejects sleepHours outside 0.5-hour steps', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      sleepHours: 7.3,
    })
    expect(result.success).toBe(false)
  })

  test('rejects an out-of-range scale value', () => {
    const result = checkInInputSchema.safeParse({ ...validCheckIn, mood: 6 })
    expect(result.success).toBe(false)
  })

  test('rejects an unknown caffeine value', () => {
    const result = checkInInputSchema.safeParse({
      ...validCheckIn,
      caffeine: 'espresso',
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
