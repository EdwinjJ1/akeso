import { EnergyEngine, ENERGY_ENGINE_CONFIG } from './energy-engine.js'
import type { CheckInInput } from './types.js'

const engine = new EnergyEngine()
const { baseline } = ENERGY_ENGINE_CONFIG

const canonicalCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
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

const sumImpacts = (factors: { impact?: number }[]) =>
  factors.reduce((total, factor) => total + (factor.impact ?? 0), 0)

// Demo evidence: this fixed, ordinary check-in always gives the same score.
const canonical = engine.evaluate(canonicalCheckIn)
assertEqual(canonical.score, 80, 'Canonical check-in score (reportedEnergy 4 → 80)')
assertEqual(canonical.band, 'high', 'Canonical band')
assertEqual(canonical.computedAt, '2026-07-21T00:00:00.000Z', 'Computed time')

// The score is driven only by reportedEnergy: the single scoring factor's
// impact reconciles the score against the neutral baseline.
assertEqual(
  canonical.score,
  baseline + sumImpacts(canonical.factors),
  'Factor impacts reconcile with the score'
)

const reportedFactor = canonical.factors.find(
  (factor) => factor.key === 'reported_energy'
)!
assert(reportedFactor !== undefined, 'A reported_energy factor is always present')
assertEqual(reportedFactor.role, 'reported_energy', 'reported_energy role')
assertEqual(reportedFactor.impact, 80 - baseline, 'reported_energy impact = score - baseline')

// Sleep, last meal and hydration are possible context only: they appear, but
// carry no point attribution (impact stays undefined).
for (const key of ['sleep_duration', 'last_meal', 'hydration'] as const) {
  const factor = canonical.factors.find((f) => f.key === key)
  assert(factor !== undefined, `A ${key} factor is present for a known value`)
  assertEqual(factor!.role, 'possible_context', `${key} role is possible_context`)
  assertEqual(factor!.impact, undefined, `${key} carries no impact`)
}

const repeated = engine.evaluate(canonicalCheckIn)
assertEqual(JSON.stringify(repeated), JSON.stringify(canonical), 'Deterministic result')

// reportedEnergy maps 1..5 → 20/40/60/80/100 and nothing else moves the score.
const scoreByReport: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
}
for (const level of [1, 2, 3, 4, 5] as const) {
  assertEqual(
    engine.score({ ...canonicalCheckIn, reportedEnergy: level }).score,
    scoreByReport[level],
    `reportedEnergy ${level} maps to ${scoreByReport[level]}`
  )
}

// Context never changes the score — only the explanation set.
assertEqual(
  engine.score({ ...canonicalCheckIn, sleepDuration: 'under_5h', hydration: 'under_0_5l' }).score,
  engine.score(canonicalCheckIn).score,
  'Context factors do not move the score'
)

// "Not sure" omits the factor rather than fabricating a reason for it.
const unsureHydration = engine.score({ ...canonicalCheckIn, hydration: 'not_sure' })
assert(
  unsureHydration.factors.find((f) => f.key === 'hydration') === undefined,
  'not_sure hydration is omitted, not invented'
)
assert(
  unsureHydration.factors.find((f) => f.key === 'reported_energy') !== undefined,
  'reported_energy survives when context is unknown'
)

// Boundary: lowest self-report with every context unknown — only the
// reported_energy factor remains, and the result stays coherent.
const lowUnknown = engine.evaluate({
  date: '2026-07-21',
  reportedEnergy: 1,
  sleepDuration: 'not_sure',
  lastMealTiming: 'not_sure',
  hydration: 'not_sure',
})
assertEqual(lowUnknown.score, 20, 'Lowest self-report scores 20')
assertEqual(lowUnknown.band, 'low', 'Lowest self-report is a low band')
assertEqual(lowUnknown.factors.length, 1, 'Only reported_energy remains when all context is unknown')

const highBoundary = engine.evaluate({
  date: '2026-07-21',
  reportedEnergy: 5,
  sleepDuration: 'over_9h',
  lastMealTiming: 'within_1h',
  hydration: 'over_2l',
})
assertEqual(highBoundary.score, 100, 'Highest self-report scores 100')

for (const result of [lowUnknown, highBoundary, canonical]) {
  assertWithinScoreRange(result.score, 'Boundary score')
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
