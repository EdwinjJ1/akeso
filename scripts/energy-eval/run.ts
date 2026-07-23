import {
  ENERGY_CALIBRATION_FIXTURES,
  evaluateEnergyCalibrationFixtures,
} from '@akeso/domain'

const metrics = evaluateEnergyCalibrationFixtures()

console.log(
  JSON.stringify(
    {
      fixtureIds: ENERGY_CALIBRATION_FIXTURES.map((fixture) => fixture.id),
      metrics,
    },
    null,
    2
  )
)
