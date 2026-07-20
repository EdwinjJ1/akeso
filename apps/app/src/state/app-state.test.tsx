import type {
  AkesoService,
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
} from '@akeso/domain'
import { act, render } from '@testing-library/react-native'
import { type ReactNode } from 'react'

import { getService } from '@/services'
import { todayISO } from '@/utils/dates'

import { AppStateProvider, useAppState } from './app-state'

jest.mock('@/services', () => ({ getService: jest.fn() }))

const mockedGetService = jest.mocked(getService)

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => jest.restoreAllMocks())

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

const plan = (date: string, id: string) =>
  ({ date, blocks: [{ id }], coachNote: id, generatedAt: `${date}T09:00:00.000Z` }) as DayPlan

const nutrition = (date: string, rationale: string) =>
  ({ date, needs: [], fridge: [], meals: [], rationale }) as NutritionPlan

const coach = (message: string) =>
  ({ message, suggestions: [], disclaimer: 'Fixture guidance only.' }) as CoachReply

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

  test('starts uninitialized and marks the first successful refresh complete', async () => {
    const service = createService()
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }

    await render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>
    )

    expect(appState.initialized).toBe(false)

    await act(async () => {
      await appState.refreshToday()
    })

    expect(appState.initialized).toBe(true)
  })

  test('keeps a confirmed check-in and clears stale derived data when its refresh fails', async () => {
    const date = todayISO()
    const previousInput = { ...checkIn(date), stress: 1 as const, notes: 'old note' }
    const submittedInput = { ...checkIn(date), stress: 5 as const, notes: 'new note' }
    const submittedEnergy = energy(date, 42)
    const service = createService({
      getTodayEnergy: jest.fn().mockResolvedValue(energy(date, 91)),
      getLatestCheckIn: jest.fn().mockResolvedValue(previousInput),
      getTodayPlan: jest
        .fn()
        .mockResolvedValueOnce(plan(date, 'stale-plan'))
        .mockRejectedValueOnce(new Error('plan unavailable')),
      getNutritionPlan: jest.fn().mockResolvedValue(nutrition(date, 'stale nutrition')),
      getCoachReply: jest.fn().mockResolvedValue(coach('stale coach')),
      submitCheckIn: jest.fn().mockResolvedValue(submittedEnergy),
    })
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }

    await render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>
    )

    await act(async () => {
      await appState.refreshToday()
    })
    expect(appState.plan).toEqual(plan(date, 'stale-plan'))

    let result!: EnergyResult
    await act(async () => {
      result = await appState.submitCheckIn(submittedInput)
    })

    expect(result).toEqual(submittedEnergy)
    expect(appState.energy).toEqual(submittedEnergy)
    expect(appState.energyDate).toBe(date)
    expect(appState.latestCheckIn).toEqual(submittedInput)
    expect(appState.latestCheckIn).not.toBe(submittedInput)
    expect(appState.plan).toBeNull()
    expect(appState.nutrition).toBeNull()
    expect(appState.coach).toBeNull()
    expect(appState.error).toBe('Your check-in was saved, but today’s guidance could not load. Retry from the dashboard.')
  })

  test('does not let late dependent results from an older submission overwrite a newer snapshot', async () => {
    const date = todayISO()
    const firstPlan = deferred<DayPlan | null>()
    const firstInput = { ...checkIn(date), stress: 2 as const, notes: 'first' }
    const secondInput = { ...checkIn(date), stress: 4 as const, notes: 'second' }
    const firstEnergy = energy(date, 77)
    const secondEnergy = energy(date, 55)
    const secondPlan = plan(date, 'second-plan')
    const secondNutrition = nutrition(date, 'second nutrition')
    const secondCoach = coach('second coach')
    const service = createService({
      submitCheckIn: jest.fn().mockResolvedValueOnce(firstEnergy).mockResolvedValueOnce(secondEnergy),
      getTodayPlan: jest.fn().mockReturnValueOnce(firstPlan.promise).mockResolvedValueOnce(secondPlan),
      getNutritionPlan: jest
        .fn()
        .mockResolvedValueOnce(nutrition(date, 'first nutrition'))
        .mockResolvedValueOnce(secondNutrition),
      getCoachReply: jest
        .fn()
        .mockResolvedValueOnce(coach('first coach'))
        .mockResolvedValueOnce(secondCoach),
    })
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }

    await render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>
    )

    let firstSubmission!: Promise<EnergyResult>
    await act(async () => {
      firstSubmission = appState.submitCheckIn(firstInput)
      await Promise.resolve()
    })

    await act(async () => {
      await appState.submitCheckIn(secondInput)
    })

    expect(appState.energy).toEqual(secondEnergy)
    expect(appState.latestCheckIn).toEqual(secondInput)
    expect(appState.plan).toEqual(secondPlan)
    expect(appState.nutrition).toEqual(secondNutrition)
    expect(appState.coach).toEqual(secondCoach)

    await act(async () => {
      firstPlan.resolve(plan(date, 'first-plan'))
      await firstSubmission
    })

    expect(appState.energy).toEqual(secondEnergy)
    expect(appState.latestCheckIn).toEqual(secondInput)
    expect(appState.plan).toEqual(secondPlan)
    expect(appState.nutrition).toEqual(secondNutrition)
    expect(appState.coach).toEqual(secondCoach)
  })

  test('keeps loaded same-day data visible during a refresh and after a failed refresh', async () => {
    const date = todayISO()
    const todayEnergy = energy(date, 68)
    const todayPlan = plan(date, 'today-plan')
    const secondEnergyLoad = deferred<EnergyResult | null>()
    const service = createService({
      getTodayEnergy: jest
        .fn()
        .mockResolvedValueOnce(todayEnergy)
        .mockReturnValueOnce(secondEnergyLoad.promise),
      getTodayPlan: jest.fn().mockResolvedValue(todayPlan),
    })
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }

    await render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>
    )

    await act(async () => {
      await appState.refreshToday()
    })
    expect(appState.energy).toEqual(todayEnergy)

    let secondRefresh!: Promise<void>
    await act(async () => {
      secondRefresh = appState.refreshToday()
      await Promise.resolve()
    })

    expect(appState.loading).toBe(true)
    expect(appState.energy).toEqual(todayEnergy)
    expect(appState.energyDate).toBe(date)
    expect(appState.plan).toEqual(todayPlan)

    await act(async () => {
      secondEnergyLoad.reject(new Error('offline'))
      await secondRefresh
    })

    expect(appState.energy).toEqual(todayEnergy)
    expect(appState.energyDate).toBe(date)
    expect(appState.plan).toEqual(todayPlan)
    expect(appState.loading).toBe(false)
    expect(appState.error).toBe('Could not load today’s data.')
  })

  test('does not let a stale latest check-in response overwrite a newer refresh', async () => {
    const date = todayISO()
    const staleInput = { ...checkIn(date), stress: 1 as const, notes: 'stale' }
    const freshInput = { ...checkIn(date), stress: 4 as const, notes: 'fresh' }
    const staleLoad = deferred<CheckInInput | null>()
    const service = createService({
      getLatestCheckIn: jest
        .fn()
        .mockReturnValueOnce(staleLoad.promise)
        .mockResolvedValueOnce(freshInput),
    })
    mockedGetService.mockReturnValue(service)

    let appState!: ReturnType<typeof useAppState>
    function Probe() {
      appState = useAppState()
      return null
    }

    await render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>
    )

    let staleRequest!: Promise<CheckInInput | null>
    await act(async () => {
      staleRequest = appState.loadLatestCheckIn(date)
      await Promise.resolve()
    })

    await act(async () => {
      await appState.refreshToday()
    })
    expect(appState.latestCheckIn).toEqual(freshInput)

    await act(async () => {
      staleLoad.resolve(staleInput)
      await expect(staleRequest).resolves.toEqual(staleInput)
    })

    expect(appState.latestCheckIn).toEqual(freshInput)
  })
})
