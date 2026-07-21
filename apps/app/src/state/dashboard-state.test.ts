import type { EnergyResult } from '@akeso/domain'
import { expect, test } from 'vitest'

import { deriveDashboardState, type DashboardStateInput } from './dashboard-state'

const TODAY = '2026-07-22'
const todayEnergy = { date: TODAY, score: 80 } as unknown as EnergyResult
const staleEnergy = { date: '2026-07-21', score: 80 } as unknown as EnergyResult

function input(overrides: Partial<DashboardStateInput> = {}): DashboardStateInput {
  return { energy: null, today: TODAY, loading: false, error: null, ...overrides }
}

test('loading: no energy yet and a load is in flight', () => {
  expect(deriveDashboardState(input({ loading: true }))).toEqual({ status: 'loading' })
})

test('empty: settled with no energy, no error → show check-in entry', () => {
  expect(deriveDashboardState(input())).toEqual({ status: 'empty' })
})

test('error: settled with no energy and an error → show retry', () => {
  expect(deriveDashboardState(input({ error: 'Could not load' }))).toEqual({
    status: 'error',
    message: 'Could not load',
  })
})

test('ready: today energy present → full dashboard', () => {
  expect(deriveDashboardState(input({ energy: todayEnergy }))).toEqual({
    status: 'ready',
    energy: todayEnergy,
    warning: null,
  })
})

test('stale energy from a previous day is ignored', () => {
  expect(deriveDashboardState(input({ energy: staleEnergy }))).toEqual({ status: 'empty' })
})

test('a failed core refresh keeps cached energy and exposes a warning', () => {
  expect(
    deriveDashboardState(input({ energy: todayEnergy, error: 'Refresh failed' }))
  ).toEqual({ status: 'ready', energy: todayEnergy, warning: 'Refresh failed' })
})

test('a refresh over existing energy keeps showing the dashboard', () => {
  expect(deriveDashboardState(input({ energy: todayEnergy, loading: true }))).toEqual({
    status: 'ready',
    energy: todayEnergy,
    warning: null,
  })
})
