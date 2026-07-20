import { EnergyEngine } from './energy-engine.js'
import type { CheckInInput } from './types.js'

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  assert(
    Object.is(actual, expected),
    `${message}: expected ${String(expected)}, received ${String(actual)}`
  )
}

function assertWithinScoreRange(score: number, message: string) {
  assert(score >= 0 && score <= 100, `${message}: ${score} is outside 0–100`)
}

// Demo evidence: this fixed, ordinary check-in always gives the same score.
const canonical = engine.evaluate(canonicalCheckIn)
assertEqual(canonical.score, 78, 'Canonical check-in score')
assertEqual(canonical.computedAt, '2026-07-21T00:00:00.000Z', 'Computed time')
assertEqual(
  canonical.score,
  50 + canonical.factors.reduce((total, factor) => total + factor.impact, 0),
  'Factor impacts reconcile with the score'
)

const repeated = engine.evaluate(canonicalCheckIn)
assertEqual(JSON.stringify(repeated), JSON.stringify(canonical), 'Deterministic result')

const normalSleep = engine.score({ ...canonicalCheckIn, caffeine: 'none' })
const sleepDeprived = engine.score({ ...canonicalCheckIn, sleepHours: 3.5 })
assert(normalSleep.score > sleepDeprived.score, 'Normal sleep should outscore short sleep')
assert(
  sleepDeprived.factors.find((factor) => factor.key === 'sleep_duration')!.impact < 0,
  'Short sleep should have a negative factor'
)

const highStress = engine.score({ ...canonicalCheckIn, stress: 5 })
assert(
  highStress.factors.find((factor) => factor.key === 'stress')!.impact < 0,
  'High stress should have a negative factor'
)

const lowMood = engine.score({ ...canonicalCheckIn, mood: 1 })
assert(
  lowMood.factors.find((factor) => factor.key === 'mood')!.impact < 0,
  'Low mood should have a negative factor'
)

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
  assertWithinScoreRange(result.score, 'Boundary score')
  assertEqual(
    result.score,
    50 + result.factors.reduce((total, factor) => total + factor.impact, 0),
    'Boundary factors reconcile with the score'
  )
  assert(result.curve.length >= 4, 'Curve should include all day periods')
  assert(
    result.curve.some((point) => point.hour < 12) &&
      result.curve.some((point) => point.hour >= 12 && point.hour < 17) &&
      result.curve.some((point) => point.hour >= 17),
    'Curve should cover morning, midday/afternoon, and evening'
  )
  result.curve.forEach((point) =>
    assertWithinScoreRange(point.level, `Curve level at ${point.hour}:00`)
  )
}
