import type {
  CheckInInput,
  EnergyBand,
  EnergyHistorySample,
  Scale1to5,
} from './types'
import {
  CURRENT_ENERGY_ALGORITHM_VERSION,
  EnergyEngine,
} from './energy-engine'

export interface EnergyCalibrationFixture {
  readonly id:
    | 'normal'
    | 'poor_sleep'
    | 'low_hydration'
    | 'long_since_eating'
    | 'conflicting_inputs'
    | 'insufficient_data'
  readonly input: CheckInInput
  readonly history?: readonly EnergyHistorySample[]
  /** Later user reflection, used only as an offline evaluation label. */
  readonly calibratedEnergy: Scale1to5
}

const baseInput: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 3,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_5_2l',
  localHour: 10,
}

/**
 * Version-controlled, fictional calibration cases. They are deliberately
 * small enough to review by hand and stable enough to compare tuning changes.
 */
export const ENERGY_CALIBRATION_FIXTURES: readonly EnergyCalibrationFixture[] = [
  {
    id: 'normal',
    input: baseInput,
    calibratedEnergy: 4,
  },
  {
    id: 'poor_sleep',
    input: { ...baseInput, sleepDuration: 'under_5h' },
    calibratedEnergy: 3,
  },
  {
    id: 'low_hydration',
    input: { ...baseInput, hydration: 'under_0_5l' },
    calibratedEnergy: 3,
  },
  {
    id: 'long_since_eating',
    input: { ...baseInput, lastMealTiming: 'over_5h' },
    calibratedEnergy: 3,
  },
  {
    id: 'conflicting_inputs',
    input: {
      ...baseInput,
      reportedEnergy: 5,
      sleepDuration: 'under_5h',
      lastMealTiming: 'not_today',
      hydration: 'under_0_5l',
      localHour: 15,
    },
    calibratedEnergy: 2,
  },
  {
    id: 'insufficient_data',
    input: {
      ...baseInput,
      sleepDuration: 'not_sure',
      lastMealTiming: 'not_sure',
      hydration: 'not_sure',
      localHour: undefined,
    },
    calibratedEnergy: 3,
  },
] as const

export interface EnergyEvaluationMetrics {
  readonly algorithmVersion: string
  readonly caseCount: number
  readonly meanAbsoluteError: number
  readonly withinTenPointsRate: number
  readonly bandAccuracy: number
  readonly meanConfidence: number
}

const targetScore = (energy: Scale1to5) => energy * 20

const targetBand = (score: number): EnergyBand =>
  score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low'

const rounded = (value: number) => Number(value.toFixed(3))

export function evaluateEnergyCalibrationFixtures(
  fixtures: readonly EnergyCalibrationFixture[] = ENERGY_CALIBRATION_FIXTURES
): EnergyEvaluationMetrics {
  if (fixtures.length === 0) {
    throw new Error('Energy evaluation needs at least one fixture')
  }
  const engine = EnergyEngine.forVersion(CURRENT_ENERGY_ALGORITHM_VERSION)
  const rows = fixtures.map((fixture) => {
    const result = engine.evaluate(fixture.input, {
      history: fixture.history,
    })
    const target = targetScore(fixture.calibratedEnergy)
    return {
      absoluteError: Math.abs(result.score - target),
      withinTen: Math.abs(result.score - target) <= 10,
      correctBand: result.band === targetBand(target),
      confidence: result.confidence,
    }
  })

  return {
    algorithmVersion: CURRENT_ENERGY_ALGORITHM_VERSION,
    caseCount: rows.length,
    meanAbsoluteError: rounded(
      rows.reduce((sum, row) => sum + row.absoluteError, 0) / rows.length
    ),
    withinTenPointsRate: rounded(
      rows.filter((row) => row.withinTen).length / rows.length
    ),
    bandAccuracy: rounded(
      rows.filter((row) => row.correctBand).length / rows.length
    ),
    meanConfidence: rounded(
      rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
    ),
  }
}
