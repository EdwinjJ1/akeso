import { test } from 'node:test'
import { strict as assert } from 'node:assert'

import { ENERGY_ENGINE_CONFIG, EnergyEngine } from './energy-engine.js'
import type { CheckInInput, EnergyFactor } from './types.js'

const engine = new EnergyEngine()

const canonicalCheckIn: CheckInInput = {
  date: '2026-07-21',
  sleepHours: 8,
  sleepQuality: 4,
  mood: 4,
  stress: 3,
  energyNow: 4,
  caffeine: 'morning',
}

const factorTotal = (factors: readonly EnergyFactor[]) =>
  factors.reduce((total, factor) => total + factor.impact, 0)

const scoreWith = (overrides: Partial<CheckInInput>) =>
  engine.score({ ...canonicalCheckIn, ...overrides })

// Demo evidence: this fixed, ordinary check-in always gives the same score.
test('canonical check-in scores 78 with a deterministic timestamp', () => {
  const canonical = engine.evaluate(canonicalCheckIn)
  assert.equal(canonical.score, 78)
  assert.equal(canonical.computedAt, '2026-07-21T00:00:00.000Z')
  assert.equal(
    canonical.score,
    ENERGY_ENGINE_CONFIG.baseScore + factorTotal(canonical.factors)
  )
})

test('identical input produces an identical result', () => {
  assert.deepEqual(
    engine.evaluate(canonicalCheckIn),
    engine.evaluate(canonicalCheckIn)
  )
})

test('normal sleep outscores sleep deprivation', () => {
  const normalSleep = scoreWith({ caffeine: 'none' })
  const sleepDeprived = scoreWith({ sleepHours: 3.5 })
  assert.ok(normalSleep.score > sleepDeprived.score)
  const duration = sleepDeprived.factors.find(
    (factor) => factor.key === 'sleep_duration'
  )
  assert.ok(duration && duration.impact < 0)
})

test('high stress and low mood turn their factors negative', () => {
  const stress = scoreWith({ stress: 5 }).factors.find(
    (factor) => factor.key === 'stress'
  )
  assert.ok(stress && stress.impact < 0)
  const mood = scoreWith({ mood: 1 }).factors.find(
    (factor) => factor.key === 'mood'
  )
  assert.ok(mood && mood.impact < 0)
})

test('band thresholds flip at exactly 40 and 70', () => {
  const at40 = scoreWith({
    sleepHours: 6,
    sleepQuality: 1,
    mood: 2,
    energyNow: 3,
    caffeine: 'afternoon',
  })
  assert.equal(at40.score, 40)
  assert.equal(at40.band, 'moderate')

  const at39 = scoreWith({
    sleepHours: 5,
    sleepQuality: 3,
    stress: 4,
    mood: 2,
    energyNow: 3,
  })
  assert.equal(at39.score, 39)
  assert.equal(at39.band, 'low')

  const at69 = scoreWith({ mood: 3, energyNow: 3, caffeine: 'none' })
  assert.equal(at69.score, 69)
  assert.equal(at69.band, 'moderate')

  const at71 = scoreWith({ mood: 3, energyNow: 3 })
  assert.equal(at71.score, 71)
  assert.equal(at71.band, 'high')
})

test('boundary inputs stay inside the contract ranges', () => {
  const lowBoundary = engine.evaluate({
    ...canonicalCheckIn,
    sleepHours: 0,
    sleepQuality: 1,
    mood: 1,
    stress: 5,
    energyNow: 1,
    caffeine: 'evening',
  })
  const highBoundary = engine.evaluate({
    ...canonicalCheckIn,
    sleepHours: 14,
    sleepQuality: 5,
    mood: 5,
    stress: 1,
    energyNow: 5,
  })

  for (const result of [lowBoundary, highBoundary]) {
    assert.ok(result.score >= 0 && result.score <= 100)
    assert.equal(
      result.score,
      ENERGY_ENGINE_CONFIG.baseScore + factorTotal(result.factors)
    )
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

test('malformed input is sanitized once, consistently', () => {
  const messy = engine.evaluate({
    ...canonicalCheckIn,
    date: 'not-a-date',
    sleepHours: Number.NaN,
    sleepQuality: 9 as CheckInInput['sleepQuality'],
    caffeine: 'espresso' as CheckInInput['caffeine'],
  })
  assert.equal(messy.date, '1970-01-01')
  assert.equal(messy.computedAt, '1970-01-01T00:00:00.000Z')

  const explicitEquivalent = engine.evaluate({
    ...canonicalCheckIn,
    date: '1970-01-01',
    sleepHours: 0,
    sleepQuality: 5,
    caffeine: 'none',
  })
  assert.deepEqual(messy, explicitEquivalent)
})

test('sleep tiers are independent of config ordering', () => {
  const shuffled = new EnergyEngine({
    ...ENERGY_ENGINE_CONFIG,
    sleepDuration: [...ENERGY_ENGINE_CONFIG.sleepDuration].reverse(),
  })
  assert.deepEqual(
    shuffled.evaluate(canonicalCheckIn),
    engine.evaluate(canonicalCheckIn)
  )
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
