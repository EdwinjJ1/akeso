import { describe, expect, test } from 'vitest'

import { EnergyEngine } from './energy-engine'
import { fixtureCheckIn, fixtureEnergyResult } from './fixtures'

/**
 * The canonical shared fixtures in @akeso/contracts claim to be genuine
 * EnergyEngine output. This lock makes that claim enforceable: any drift
 * between fixture copy/values and what the engine actually produces fails
 * here instead of shipping inconsistent demo data.
 */
describe('shared fixtures', () => {
  test('fixtureEnergyResult is engine.evaluate(fixtureCheckIn)', () => {
    expect(new EnergyEngine().evaluate(fixtureCheckIn)).toEqual(
      fixtureEnergyResult
    )
  })
})
