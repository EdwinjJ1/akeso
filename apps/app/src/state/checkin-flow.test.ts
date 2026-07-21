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
  const patches: AppStatePatch[] = []
  const result = await runSubmitCheckIn(makeService(), input, (p) => patches.push(p))

  expect(result).toBe(energy)
  expect(patches).toHaveLength(2)
  // Phase 1: score arrives, stale dependent guidance is cleared, error reset.
  expect(patches[0]).toMatchObject({
    energy,
    plan: null,
    nutrition: null,
    coach: null,
    error: null,
  })
  expect(patches[0].latestCheckIn).toEqual(input)
  // Phase 2: guidance fills in.
  expect(patches[1]).toEqual({ plan, nutrition, coach })
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

test('keeps the score when guidance fails and reports a recoverable error', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const service = makeService({
    getTodayPlan: vi.fn(async () => {
      throw new Error('network down')
    }),
  })
  const patches: AppStatePatch[] = []
  const result = await runSubmitCheckIn(service, input, (p) => patches.push(p))

  expect(result).toBe(energy) // the check-in itself still succeeds
  expect(patches[0]).toMatchObject({ energy }) // score already applied
  expect(patches[1].error).toMatch(/check-in was saved/i)
  expect(patches[1]).not.toHaveProperty('plan')
})
