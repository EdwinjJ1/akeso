import { describe, expect, test } from 'vitest'

import {
  ENERGY_CALIBRATION_FIXTURES,
  evaluateEnergyCalibrationFixtures,
} from './energy-evaluation'
import { EnergyEngine } from './energy-engine'

describe('offline energy evaluation baseline', () => {
  test('contains every Issue #55 calibration scenario', () => {
    expect(ENERGY_CALIBRATION_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'normal',
      'poor_sleep',
      'low_hydration',
      'long_since_eating',
      'conflicting_inputs',
      'insufficient_data',
    ])
  })

  test('every fixture is deterministic and missing data is low confidence', () => {
    const engine = new EnergyEngine()
    for (const fixture of ENERGY_CALIBRATION_FIXTURES) {
      const first = engine.evaluate(fixture.input, {
        history: fixture.history,
      })
      expect(first).toEqual(
        engine.evaluate(fixture.input, { history: fixture.history })
      )
    }
    const insufficient = engine.evaluate(
      ENERGY_CALIBRATION_FIXTURES.find(
        (fixture) => fixture.id === 'insufficient_data'
      )!.input
    )
    expect(insufficient.confidence).toBe(0.48)
  })

  test('locks reproducible tuning metrics for this version', () => {
    expect(evaluateEnergyCalibrationFixtures()).toEqual({
      algorithmVersion: 'energy-v2-multisignal',
      caseCount: 6,
      meanAbsoluteError: 2.833,
      withinTenPointsRate: 1,
      bandAccuracy: 1,
      meanConfidence: 0.697,
    })
  })
})
