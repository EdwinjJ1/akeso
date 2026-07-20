import type { CheckInInput, EnergyResult } from '@akeso/domain'

import { selectDashboardContent } from './dashboard-content'

const energy = { score: 72 } as EnergyResult
const priorCheckIn = { date: '2026-07-20' } as CheckInInput

describe('selectDashboardContent', () => {
  test('withholds a previous-day score on a new calendar day', () => {
    expect(
      selectDashboardContent({
        initialized: true,
        loading: false,
        error: null,
        energy,
        energyDate: '2026-07-20',
        latestCheckIn: priorCheckIn,
        today: '2026-07-21',
      })
    ).toEqual({ energy: null, promptMode: 'daily' })
  })

  test('withholds the check-in prompt after a failed refresh', () => {
    expect(
      selectDashboardContent({
        initialized: true,
        loading: false,
        error: 'Could not load today’s data.',
        energy: null,
        energyDate: null,
        latestCheckIn: null,
        today: '2026-07-21',
      })
    ).toEqual({ energy: null, promptMode: null })
  })

  test('selects the daily prompt after a completed load with a prior check-in and no score', () => {
    expect(
      selectDashboardContent({
        initialized: true,
        loading: false,
        error: null,
        energy: null,
        energyDate: null,
        latestCheckIn: priorCheckIn,
        today: '2026-07-21',
      })
    ).toEqual({ energy: null, promptMode: 'daily' })
  })

  test('selects the first check-in prompt after a completed load with no check-in', () => {
    expect(
      selectDashboardContent({
        initialized: true,
        loading: false,
        error: null,
        energy: null,
        energyDate: null,
        latestCheckIn: null,
        today: '2026-07-21',
      })
    ).toEqual({ energy: null, promptMode: 'first' })
  })

  test('selects no prompt before the first dashboard refresh completes', () => {
    expect(
      selectDashboardContent({
        initialized: false,
        loading: false,
        error: null,
        energy: null,
        energyDate: null,
        latestCheckIn: null,
        today: '2026-07-21',
      })
    ).toEqual({ energy: null, promptMode: null })
  })
})
