import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
} from '@akeso/domain'
import { expect, test, vi } from 'vitest'

import {
  runSubmitCheckIn,
  type AppStatePatch,
  type CheckInFlowService,
} from './checkin-flow'

const input: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

const energy = { score: 80 } as unknown as EnergyResult
const plan = { date: '2026-07-21' } as unknown as DayPlan
const nutrition = { date: '2026-07-21' } as unknown as NutritionPlan
const coach = { message: 'hi' } as unknown as CoachReply

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function makeService(
  overrides: Partial<CheckInFlowService> = {}
): CheckInFlowService {
  return {
    submitCheckIn: vi.fn(async () => energy),
    getTodayPlan: vi.fn(async () => plan),
    getNutritionPlan: vi.fn(async () => nutrition),
    getCoachReply: vi.fn(async () => coach),
    ...overrides,
  }
}

test('lands the score first, then fills guidance in a second patch', async () => {
  const planDeferred = deferred<DayPlan>()
  const nutritionDeferred = deferred<NutritionPlan>()
  const coachDeferred = deferred<CoachReply>()
  const service = makeService({
    getTodayPlan: vi.fn(() => planDeferred.promise),
    getNutritionPlan: vi.fn(() => nutritionDeferred.promise),
    getCoachReply: vi.fn(() => coachDeferred.promise),
  })
  const patches: AppStatePatch[] = []
  const result = await runSubmitCheckIn(service, input, (p) => patches.push(p))

  expect(result).toBe(energy)
  expect(patches).toHaveLength(1)
  // Phase 1: score arrives, stale dependent guidance is cleared, error reset.
  expect(patches[0]).toMatchObject({
    energy,
    plan: null,
    nutrition: null,
    coach: null,
    error: null,
  })
  expect(patches[0].latestCheckIn).toEqual(input)

  planDeferred.resolve(plan)
  nutritionDeferred.resolve(nutrition)
  coachDeferred.resolve(coach)
  await flushPromises()

  // Phase 2: guidance fills in.
  expect(patches).toHaveLength(2)
  expect(patches[1]).toEqual({
    plan,
    nutrition,
    coach,
    ancillaryDate: input.date,
    planLoading: false,
    planError: null,
    coachLoading: false,
    coachError: null,
  })
})

test('the score patch never touches loading, so it cannot clobber a refresh', async () => {
  const patches: AppStatePatch[] = []
  await runSubmitCheckIn(makeService(), input, (p) => patches.push(p))
  expect('loading' in patches[0]).toBe(false)
})

test('stores a copy of the submitted input, not the caller mutable object', async () => {
  const patches: AppStatePatch[] = []
  const mutable = { ...input }
  await runSubmitCheckIn(makeService(), mutable, (p) => patches.push(p))
  expect(patches[0].latestCheckIn).not.toBe(mutable)
  expect(patches[0].latestCheckIn).toEqual(input)
})

test('keeps the score when guidance fails and reports module errors', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const service = makeService({
    getTodayPlan: vi.fn(async () => {
      throw new Error('network down')
    }),
  })
  const patches: AppStatePatch[] = []
  const result = await runSubmitCheckIn(service, input, (p) => patches.push(p))

  expect(result).toBe(energy) // the check-in itself still succeeds
  expect(patches[0]).toMatchObject({ energy }) // score already applied
  await flushPromises()
  expect(patches[1].planError).toMatch(/check-in was saved/i)
  expect(patches[1].coachError).toMatch(/check-in was saved/i)
  expect(patches[1]).not.toHaveProperty('error')
  expect(patches[1]).not.toHaveProperty('plan')
  consoleError.mockRestore()
})
