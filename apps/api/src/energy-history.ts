import type { EnergyEvaluationContext } from '@akeso/domain'

import type { Repos } from './repos'

const HISTORY_LIMIT = 28

/**
 * Loads only owner-scoped, bounded history and reduces it to the minimum
 * signal set the pure domain engine needs. Calibration without a matching
 * check-in is ignored rather than inventing a historical observation.
 */
export async function loadEnergyHistory(
  repos: Repos,
  userId: string,
  beforeDate: string
): Promise<EnergyEvaluationContext> {
  const [checkins, calibrations] = await Promise.all([
    repos.checkins.listBefore(userId, beforeDate, HISTORY_LIMIT),
    repos.energyCalibrations.listBefore(userId, beforeDate, HISTORY_LIMIT),
  ])
  const calibrationByDate = new Map(
    calibrations.map((calibration) => [calibration.date, calibration])
  )

  return {
    history: checkins.map((checkin) => ({
      date: checkin.date,
      reportedEnergy: checkin.reportedEnergy,
      ...(calibrationByDate.get(checkin.date)
        ? {
            calibratedEnergy:
              calibrationByDate.get(checkin.date)!.actualEnergy,
          }
        : {}),
    })),
  }
}
