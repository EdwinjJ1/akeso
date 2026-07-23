import { describe, expect, test } from 'vitest'

import {
  CURRENT_ENERGY_ALGORITHM_VERSION,
  ENERGY_ENGINE_CONFIG,
  EnergyEngine,
  LEGACY_ENERGY_ALGORITHM_VERSION,
} from './energy-engine'
import type { CheckInInput, EnergyHistorySample } from './types'

const engine = new EnergyEngine()

const canonicalCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
  localHour: 10,
}

const scoreWith = (overrides: Partial<CheckInInput>) =>
  engine.evaluate({ ...canonicalCheckIn, ...overrides })

describe('multi-signal scoring', () => {
  test('canonical check-in is deterministic, versioned and explainable', () => {
    const result = engine.evaluate(canonicalCheckIn)

    expect(result).toEqual(engine.evaluate(canonicalCheckIn))
    expect(result).toMatchObject({
      score: 83,
      band: 'high',
      algorithmVersion: CURRENT_ENERGY_ALGORITHM_VERSION,
      confidence: 0.76,
      personalBaseline: { score: 60, sampleSize: 0, source: 'cold_start' },
      baselineDelta: 23,
      computedAt: '2026-07-21T00:00:00.000Z',
    })
    expect(result.factors.map((factor) => factor.key)).toEqual([
      'reported_energy',
      'sleep_duration',
      'last_meal',
      'hydration',
      'time_rhythm',
    ])
    expect(
      60 +
        result.factors.reduce(
          (sum, factor) => sum + ('impact' in factor ? factor.impact : 0),
          0
        )
    ).toBe(result.score)
  })

  test('sleep, food, hydration and time rhythm all affect the number', () => {
    const normal = scoreWith({})
    expect(scoreWith({ sleepDuration: 'under_5h' }).score).toBeLessThan(
      normal.score
    )
    expect(scoreWith({ lastMealTiming: 'over_5h' }).score).toBeLessThan(
      normal.score
    )
    expect(scoreWith({ hydration: 'under_0_5l' }).score).toBeLessThan(
      normal.score
    )
    expect(scoreWith({ localHour: 15 }).score).toBeLessThan(normal.score)
  })

  test('not_sure is neutral, omitted and lowers confidence', () => {
    const known = scoreWith({})
    const unsure = scoreWith({
      sleepDuration: 'not_sure',
      lastMealTiming: 'not_sure',
      hydration: 'not_sure',
      localHour: undefined,
    })

    expect(unsure.factors.map((factor) => factor.key)).toEqual([
      'reported_energy',
    ])
    expect(unsure.confidence).toBeLessThan(known.confidence)
    expect(unsure.score).toBe(72)
    expect(unsure.headline).toContain('Limited signals')
  })

  test('conflicting inputs reduce confidence instead of hiding disagreement', () => {
    const consistent = scoreWith({ reportedEnergy: 2, sleepDuration: 'under_5h' })
    const conflicting = scoreWith({
      reportedEnergy: 5,
      sleepDuration: 'under_5h',
      lastMealTiming: 'not_today',
      hydration: 'under_0_5l',
      localHour: 15,
    })

    expect(conflicting.confidence).toBeLessThan(consistent.confidence)
    expect(conflicting.factors.some((factor) => 'impact' in factor && factor.impact > 0)).toBe(
      true
    )
    expect(conflicting.factors.some((factor) => 'impact' in factor && factor.impact < 0)).toBe(
      true
    )
  })

  test('all scores and curve points remain inside contract bounds', () => {
    for (const input of [
      {
        ...canonicalCheckIn,
        reportedEnergy: 1 as const,
        sleepDuration: 'under_5h' as const,
        lastMealTiming: 'not_today' as const,
        hydration: 'under_0_5l' as const,
        localHour: 2,
      },
      {
        ...canonicalCheckIn,
        reportedEnergy: 5 as const,
        hydration: 'over_2l' as const,
      },
    ]) {
      const result = engine.evaluate(input)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      result.curve.forEach((point) => {
        expect(point.level).toBeGreaterThanOrEqual(0)
        expect(point.level).toBeLessThanOrEqual(100)
      })
    }
  })
})

describe('personal baseline and version replay', () => {
  const history: EnergyHistorySample[] = [
    { date: '2026-07-18', reportedEnergy: 2 },
    { date: '2026-07-19', reportedEnergy: 3 },
    { date: '2026-07-20', reportedEnergy: 4, calibratedEnergy: 5 },
  ]

  test('cold start is safe until the minimum history size is reached', () => {
    const result = engine.evaluate(canonicalCheckIn, {
      history: history.slice(0, 2),
    })
    expect(result.personalBaseline).toEqual({
      score: 60,
      sampleSize: 2,
      source: 'cold_start',
    })
  })

  test('history and later calibration set a personal baseline', () => {
    const result = engine.evaluate(canonicalCheckIn, { history })
    expect(result.personalBaseline).toEqual({
      score: 75,
      sampleSize: 3,
      source: 'calibrated',
    })
    expect(result.baselineDelta).toBe(result.score - 75)
    expect(result.baselineExplanation).toContain('calibrated 3-day baseline')
  })

  test('a persisted baseline snapshot makes replay immune to later calibration', () => {
    const original = engine.evaluate(canonicalCheckIn, { history })
    const changedHistory = history.map((sample) => ({
      ...sample,
      calibratedEnergy: 1 as const,
    }))
    const replay = engine.evaluate(canonicalCheckIn, {
      history: changedHistory,
      baseline: original.personalBaseline,
    })

    expect(replay).toEqual(original)
  })

  test('future or same-day history is ignored', () => {
    const result = engine.evaluate(canonicalCheckIn, {
      history: [
        ...history.slice(0, 2),
        { date: canonicalCheckIn.date, reportedEnergy: 5 },
        { date: '2026-07-22', reportedEnergy: 5 },
      ],
    })
    expect(result.personalBaseline.source).toBe('cold_start')
    expect(result.personalBaseline.sampleSize).toBe(2)
  })

  test('legacy replay preserves the original self-report-only score', () => {
    const legacy = EnergyEngine.forVersion(LEGACY_ENERGY_ALGORITHM_VERSION)
    const result = legacy.evaluate(canonicalCheckIn, { history })
    expect(result.score).toBe(80)
    expect(result.algorithmVersion).toBe(LEGACY_ENERGY_ALGORITHM_VERSION)
    expect(result.factors).toHaveLength(4)
    expect(result.headline).toBe(
      'Strong day ahead — protect 10:00–12:00 for demanding work.'
    )
  })

  test('unknown algorithm versions fail closed', () => {
    expect(() => EnergyEngine.forVersion('energy-v999')).toThrow(
      'Unsupported energy algorithm version'
    )
  })
})

describe('defensive deterministic boundaries', () => {
  test('malformed direct-call input is sanitized consistently', () => {
    const messy = engine.evaluate({
      ...canonicalCheckIn,
      date: 'not-a-date',
      reportedEnergy: Number.NaN as CheckInInput['reportedEnergy'],
    })
    const equivalent = engine.evaluate({
      ...canonicalCheckIn,
      date: '1970-01-01',
      reportedEnergy: 1,
    })
    expect(messy).toEqual(equivalent)
  })

  test('custom curves retain a safe dip fallback', () => {
    const sparse = new EnergyEngine({
      ...ENERGY_ENGINE_CONFIG,
      curveOffsets: [
        { hour: 8, offset: 4 },
        { hour: 20, offset: -12 },
      ],
    })
    expect(sparse.evaluate(canonicalCheckIn).dipWindow).toEqual({
      startHour: 19,
      endHour: 21,
    })
  })

  test('empty curve config is rejected', () => {
    expect(
      () =>
        new EnergyEngine({
          ...ENERGY_ENGINE_CONFIG,
          curveOffsets: [],
        })
    ).toThrow()
  })
})
