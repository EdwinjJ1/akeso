import type { AkesoService, CheckInInput, CoachReply, EnergyResult } from '@akeso/domain'
import { act, render } from '@testing-library/react-native'
import { type ReactNode } from 'react'

import { getService } from '@/services'
import { todayISO } from '@/utils/dates'

import { AppStateProvider, useAppState } from './app-state'

jest.mock('@/services', () => ({ getService: jest.fn() }))

const mockedGetService = jest.mocked(getService)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function energy(date: string, score: number): EnergyResult {
  return {
    date,
    score,
    band: 'moderate',
    headline: 'Steady enough to focus.',
    factors: [],
    curve: [],
    peakWindow: { startHour: 9, endHour: 11 },
    dipWindow: { startHour: 14, endHour: 15 },
    computedAt: '2026-07-21T09:00:00.000Z',
  }
}

const checkIn = (date: string): CheckInInput => ({
  date,
  sleepHours: 8,
  sleepQuality: 4,
  mood: 4,
  stress: 2,
  energyNow: 4,
  caffeine: 'morning',
})

function createService(overrides: Partial<jest.Mocked<AkesoService>> = {}): jest.Mocked<AkesoService> {
  return {
    getProfile: jest.fn().mockResolvedValue(null),
    saveProfile: jest.fn(),
    submitCheckIn: jest.fn(),
    getLatestCheckIn: jest.fn().mockResolvedValue(null),
    getTodayEnergy: jest.fn().mockResolvedValue(null),
    getTasks: jest.fn().mockResolvedValue([]),
    getTodayPlan: jest.fn().mockResolvedValue(null),
    regeneratePlan: jest.fn(),
    getNutritionPlan: jest.fn().mockResolvedValue(null),
    getCoachReply: jest.fn().mockResolvedValue({} as CoachReply),
    ...overrides,
  }
}

describe('AppStateProvider refresh races', () => {
  test('does not let overlapping stale refreshes replace a successful same-day submission', async () => {
    const date = todayISO()
    const lateSuccess = deferred<EnergyResult | null>()
    const lateFailure = deferred<EnergyResult | null>()
    const submittedEnergy = energy(date, 84)
    const service = createService({
      getTodayEnergy: jest
        .fn()
        .mockReturnValueOnce(lateSuccess.promise)
        .mockReturnValueOnce(lateFailure.promise),
      submitCheckIn: jest.fn().mockResolvedValue(submittedEnergy),
    })
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }
    function Wrapper({ children }: { children: ReactNode }) {
      return <AppStateProvider>{children}</AppStateProvider>
    }

    await render(<Probe />, { wrapper: Wrapper })

    let firstRefresh!: Promise<void>
    await act(async () => {
      firstRefresh = appState.refreshToday()
      await Promise.resolve()
    })

    let secondRefresh!: Promise<void>
    await act(async () => {
      secondRefresh = appState.refreshToday()
      await Promise.resolve()
    })

    await act(async () => {
      await appState.submitCheckIn(checkIn(date))
    })

    expect(appState.energy).toEqual(submittedEnergy)
    expect(appState.energyDate).toBe(date)

    await act(async () => {
      lateSuccess.resolve(energy(date, 31))
      await firstRefresh
    })

    await act(async () => {
      lateFailure.reject(new Error('Network unavailable'))
      await secondRefresh
    })

    expect(appState.energy).toEqual(submittedEnergy)
    expect(appState.energyDate).toBe(date)
    expect(appState.loading).toBe(false)
    expect(appState.error).toBeNull()
  })
})
