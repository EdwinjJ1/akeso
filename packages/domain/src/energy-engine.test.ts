import { test } from 'vitest'
import { strict as assert } from 'node:assert'

import { ENERGY_ENGINE_CONFIG, EnergyEngine } from './energy-engine.js'
import type { CheckInInput, EnergyFactor } from './types.js'

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
  assert.equal(canonical.score, 80)
  assert.equal(canonical.band, 'high')
  assert.equal(canonical.computedAt, '2026-07-21T00:00:00.000Z')
  assert.equal(
    canonical.score,
    baseline + reportedImpactTotal(canonical.factors)
  )
})

test('identical input produces an identical result', () => {
  assert.deepEqual(
    engine.evaluate(canonicalCheckIn),
    engine.evaluate(canonicalCheckIn)
  )
})

test('reported_energy is always present and reconciles with the score', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  const reported = canonical.factors.find(
    (factor) => factor.key === 'reported_energy'
  )
  assert.ok(reported)
  assert.ok(reported.role === 'reported_energy')
  assert.equal(reported.impact, 80 - baseline)
})

test('sleep, meal and hydration are possible context with no impact', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  for (const key of ['sleep_duration', 'last_meal', 'hydration'] as const) {
    const factor = canonical.factors.find((f) => f.key === key)
    assert.ok(factor, `${key} factor is present for a known value`)
    assert.equal(factor.role, 'possible_context')
    assert.ok(!('impact' in factor))
  }
})

test('reportedEnergy maps 1..5 straight onto the score', () => {
  const scoreByReport = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 } as const
  for (const level of [1, 2, 3, 4, 5] as const) {
    assert.equal(
      scoreWith({ reportedEnergy: level }).score,
      scoreByReport[level]
    )
  }
})

test('context inputs never move the score', () => {
  assert.equal(
    scoreWith({ sleepDuration: 'under_5h', hydration: 'under_0_5l' }).score,
    scoreWith({}).score
  )
})

test('"not sure" omits the factor rather than fabricating a reason', () => {
  const unsure = scoreWith({ hydration: 'not_sure' })
  assert.equal(
    unsure.factors.find((factor) => factor.key === 'hydration'),
    undefined
  )
  assert.ok(unsure.factors.find((factor) => factor.key === 'reported_energy'))
})

test('boundary self-reports stay inside the contract ranges', () => {
  const lowUnknown = engine.evaluate({
    date: '2026-07-21',
    reportedEnergy: 1,
    sleepDuration: 'not_sure',
    lastMealTiming: 'not_sure',
    hydration: 'not_sure',
  })
  assert.equal(lowUnknown.score, 20)
  assert.equal(lowUnknown.band, 'low')
  assert.equal(lowUnknown.factors.length, 1)

  const highBoundary = engine.evaluate({
    date: '2026-07-21',
    reportedEnergy: 5,
    sleepDuration: 'over_9h',
    lastMealTiming: 'within_1h',
    hydration: 'over_2l',
  })
  assert.equal(highBoundary.score, 100)

  for (const result of [lowUnknown, highBoundary]) {
    assert.ok(result.score >= 0 && result.score <= 100)
    assert.ok(result.curve.length >= 4)
    assert.ok(result.curve.some((point) => point.hour < 12))
    assert.ok(
      result.curve.some((point) => point.hour >= 12 && point.hour < 17)
    )
    assert.ok(result.curve.some((point) => point.hour >= 17))
    for (const point of result.curve) {
      assert.ok(point.level >= 0 && point.level <= 100)
    }
  }
})

test('the headline lives on evaluate() alone and quotes the peak window', () => {
  const score = engine.score(canonicalCheckIn)
  assert.ok(!('headline' in score))
  const result = engine.evaluate(canonicalCheckIn)
  assert.equal(
    result.headline,
    'Strong day ahead — protect 10:00–12:00 for demanding work.'
  )
})

test('mostly-unknown context switches to the hedged headline', () => {
  const result = engine.evaluate({
    ...canonicalCheckIn,
    sleepDuration: 'not_sure',
    lastMealTiming: 'not_sure',
  })
  assert.ok(result.headline.startsWith('Going mostly on how you feel today'))
})

test('malformed input is sanitized once, consistently', () => {
  const messy = engine.evaluate({
    ...canonicalCheckIn,
    date: 'not-a-date',
    reportedEnergy: Number.NaN as CheckInInput['reportedEnergy'],
  })
  assert.equal(messy.date, '1970-01-01')
  assert.equal(messy.computedAt, '1970-01-01T00:00:00.000Z')

  const explicitEquivalent = engine.evaluate({
    ...canonicalCheckIn,
    date: '1970-01-01',
    reportedEnergy: 1,
  })
  assert.deepEqual(messy, explicitEquivalent)
})

test('an impossible calendar date is rejected, not just format-checked', () => {
  // 2026-13-45 satisfies a naive YYYY-MM-DD regex but is not a real day. It
  // must be sanitized like any other bad input and never echoed back through
  // `date`/`computedAt` as if it were a genuine date.
  const impossible = engine.evaluate({ ...canonicalCheckIn, date: '2026-13-45' })
  assert.equal(impossible.date, '1970-01-01')
  assert.equal(impossible.computedAt, '1970-01-01T00:00:00.000Z')

  // A real calendar date on the same code path is preserved unchanged.
  const real = engine.evaluate({ ...canonicalCheckIn, date: '2026-02-28' })
  assert.equal(real.date, '2026-02-28')
  assert.equal(real.computedAt, '2026-02-28T00:00:00.000Z')
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
  assert.deepEqual(result.dipWindow, { startHour: 19, endHour: 21 })
})

test('an empty curve config is rejected at construction', () => {
  assert.throws(
    () => new EnergyEngine({ ...ENERGY_ENGINE_CONFIG, curveOffsets: [] })
  )
})
