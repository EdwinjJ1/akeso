import { expect, test } from 'vitest'

import { ENERGY_ENGINE_CONFIG, EnergyEngine } from './energy-engine'
import type { CheckInInput, EnergyFactor } from './types'

const engine = new EnergyEngine()
const { baseline } = ENERGY_ENGINE_CONFIG

const canonicalCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

const scoreWith = (overrides: Partial<CheckInInput>) =>
  engine.score({ ...canonicalCheckIn, ...overrides })

// Only the single scoring factor carries an impact; context factors do not.
const reportedImpactTotal = (factors: readonly EnergyFactor[]) =>
  factors.reduce(
    (total, factor) =>
      total + (factor.role === 'reported_energy' ? factor.impact : 0),
    0
  )

test('canonical check-in scores 80 with a deterministic timestamp', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  expect(canonical.score).toBe(80)
  expect(canonical.band).toBe('high')
  expect(canonical.computedAt).toBe('2026-07-21T00:00:00.000Z')
  expect(canonical.score).toBe(
    baseline + reportedImpactTotal(canonical.factors)
  )
})

test('identical input produces an identical result', () => {
  expect(engine.evaluate(canonicalCheckIn)).toEqual(
    engine.evaluate(canonicalCheckIn)
  )
})

test('reported_energy is always present and reconciles with the score', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  const reported = canonical.factors.find(
    (factor) => factor.key === 'reported_energy'
  )

  expect(reported).toBeTruthy()
  if (!reported || reported.role !== 'reported_energy') {
    throw new Error('Expected reported_energy factor')
  }
  expect(reported.impact).toBe(80 - baseline)
})

test('sleep, meal and hydration are possible context with no impact', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  for (const key of ['sleep_duration', 'last_meal', 'hydration'] as const) {
    const factor = canonical.factors.find((f) => f.key === key)
    expect(factor, `${key} factor is present for a known value`).toBeTruthy()
    if (!factor) throw new Error(`Missing ${key} factor`)

    expect(factor.role).toBe('possible_context')
    expect('impact' in factor).toBe(false)
  }
})

test('reportedEnergy maps 1..5 straight onto the score', () => {
  const scoreByReport = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 } as const
  for (const level of [1, 2, 3, 4, 5] as const) {
    expect(scoreWith({ reportedEnergy: level }).score).toBe(scoreByReport[level])
  }
})

test('context inputs never move the score', () => {
  expect(
    scoreWith({ sleepDuration: 'under_5h', hydration: 'under_0_5l' }).score
  ).toBe(scoreWith({}).score)
})

test('"not sure" omits the factor rather than fabricating a reason', () => {
  const unsure = scoreWith({ hydration: 'not_sure' })
  expect(unsure.factors.find((factor) => factor.key === 'hydration')).toBeUndefined()
  expect(unsure.factors.find((factor) => factor.key === 'reported_energy')).toBeTruthy()
})

test('boundary self-reports stay inside the contract ranges', () => {
  const lowUnknown = engine.evaluate({
    date: '2026-07-21',
    reportedEnergy: 1,
    sleepDuration: 'not_sure',
    lastMealTiming: 'not_sure',
    hydration: 'not_sure',
  })
  expect(lowUnknown.score).toBe(20)
  expect(lowUnknown.band).toBe('low')
  expect(lowUnknown.factors.length).toBe(1)

  const highBoundary = engine.evaluate({
    date: '2026-07-21',
    reportedEnergy: 5,
    sleepDuration: 'over_9h',
    lastMealTiming: 'within_1h',
    hydration: 'over_2l',
  })
  expect(highBoundary.score).toBe(100)

  for (const result of [lowUnknown, highBoundary]) {
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.curve.length).toBeGreaterThanOrEqual(4)
    expect(result.curve.some((point) => point.hour < 12)).toBe(true)
    expect(
      result.curve.some((point) => point.hour >= 12 && point.hour < 17)
    ).toBe(true)
    expect(result.curve.some((point) => point.hour >= 17)).toBe(true)
    for (const point of result.curve) {
      expect(point.level).toBeGreaterThanOrEqual(0)
      expect(point.level).toBeLessThanOrEqual(100)
    }
  }
})

test('the headline lives on evaluate() alone and quotes the peak window', () => {
  const score = engine.score(canonicalCheckIn)
  expect('headline' in score).toBe(false)

  const result = engine.evaluate(canonicalCheckIn)
  expect(result.headline).toContain('Strong day ahead')
  expect(result.headline).toContain('10:00')
  expect(result.headline).toContain('12:00')
})

test('mostly-unknown context switches to the hedged headline', () => {
  const result = engine.evaluate({
    ...canonicalCheckIn,
    sleepDuration: 'not_sure',
    lastMealTiming: 'not_sure',
  })
  expect(result.headline.startsWith('Going mostly on how you feel today')).toBe(true)
})

test('malformed input is sanitized once, consistently', () => {
  const messy = engine.evaluate({
    ...canonicalCheckIn,
    date: 'not-a-date',
    reportedEnergy: Number.NaN as CheckInInput['reportedEnergy'],
  })
  expect(messy.date).toBe('1970-01-01')
  expect(messy.computedAt).toBe('1970-01-01T00:00:00.000Z')

  const explicitEquivalent = engine.evaluate({
    ...canonicalCheckIn,
    date: '1970-01-01',
    reportedEnergy: 1,
  })
  expect(messy).toEqual(explicitEquivalent)
})

test('an impossible calendar date is rejected, not just format-checked', () => {
  // 2026-13-45 satisfies a naive YYYY-MM-DD regex but is not a real day. It
  // must be sanitized like any other bad input and never echoed back through
  // `date`/`computedAt` as if it were a genuine date.
  const impossible = engine.evaluate({ ...canonicalCheckIn, date: '2026-13-45' })
  expect(impossible.date).toBe('1970-01-01')
  expect(impossible.computedAt).toBe('1970-01-01T00:00:00.000Z')

  // A real calendar date on the same code path is preserved unchanged.
  const real = engine.evaluate({ ...canonicalCheckIn, date: '2026-02-28' })
  expect(real.date).toBe('2026-02-28')
  expect(real.computedAt).toBe('2026-02-28T00:00:00.000Z')
})

test('a curve with no afternoon points still yields a dip window', () => {
  const sparse = new EnergyEngine({
    ...ENERGY_ENGINE_CONFIG,
    curveOffsets: [
      { hour: 8, offset: 4 },
      { hour: 20, offset: -12 },
    ],
  })
  const result = sparse.evaluate(canonicalCheckIn)
  expect(result.dipWindow).toEqual({ startHour: 19, endHour: 21 })
})

test('an empty curve config is rejected at construction', () => {
  expect(() => new EnergyEngine({ ...ENERGY_ENGINE_CONFIG, curveOffsets: [] })).toThrow()
})
