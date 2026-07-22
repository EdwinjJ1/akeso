import { afterEach, beforeEach, expect, test } from 'vitest'

import { deriveReminderState, nextReminderTrigger } from './reminders.js'
import type { ReminderPreference } from './types.js'

// This package has no @types/node (it's meant to stay runtime-agnostic
// between the Node-based API/tests and the RN app) — scoped to this file
// only, just enough to mutate TZ for the DST test below.
declare const process: { env: Record<string, string | undefined> }

const pref = (overrides: Partial<ReminderPreference> = {}): ReminderPreference => ({
  enabled: true,
  checkInTime: '08:00',
  timezone: 'Australia/Sydney',
  ...overrides,
})

// ── deriveReminderState ──────────────────────────────────────────────────────

test('no preference yet → disabled, even if it happens to be past 08:00', () => {
  const state = deriveReminderState({
    preference: null,
    hasCheckedInToday: false,
    now: new Date(2026, 6, 21, 9, 0),
  })
  expect(state).toEqual({ kind: 'disabled' })
})

test('preference exists but reminders are turned off → disabled', () => {
  const state = deriveReminderState({
    preference: pref({ enabled: false }),
    hasCheckedInToday: false,
    now: new Date(2026, 6, 21, 9, 0),
  })
  expect(state).toEqual({ kind: 'disabled' })
})

test('before check-in time and not checked in → scheduled', () => {
  const state = deriveReminderState({
    preference: pref({ checkInTime: '08:00' }),
    hasCheckedInToday: false,
    now: new Date(2026, 6, 21, 7, 59),
  })
  expect(state).toEqual({ kind: 'scheduled', checkInTime: '08:00' })
})

test('at or after check-in time and not checked in → due', () => {
  const state = deriveReminderState({
    preference: pref({ checkInTime: '08:00' }),
    hasCheckedInToday: false,
    now: new Date(2026, 6, 21, 8, 0),
  })
  expect(state).toEqual({ kind: 'due', checkInTime: '08:00' })
})

test('already checked in today → done, even before the reminder time', () => {
  const state = deriveReminderState({
    preference: pref({ checkInTime: '20:00' }),
    hasCheckedInToday: true,
    now: new Date(2026, 6, 21, 6, 0),
  })
  expect(state).toEqual({ kind: 'done' })
})

test('checked in today wins even if reminders are disabled', () => {
  const state = deriveReminderState({
    preference: pref({ enabled: false }),
    hasCheckedInToday: true,
    now: new Date(2026, 6, 21, 6, 0),
  })
  expect(state).toEqual({ kind: 'done' })
})

// ── nextReminderTrigger ───────────────────────────────────────────────────────

test('reminders off → no scheduled trigger', () => {
  expect(nextReminderTrigger(pref({ enabled: false }), new Date(2026, 6, 21, 6, 0), false)).toBeNull()
})

test('before today\'s time and not checked in → schedules for today', () => {
  const now = new Date(2026, 6, 21, 7, 0)
  const trigger = nextReminderTrigger(pref({ checkInTime: '08:00' }), now, false)
  expect(trigger).toEqual(new Date(2026, 6, 21, 8, 0))
})

test('after today\'s time and not checked in → rolls to tomorrow, same local time', () => {
  const now = new Date(2026, 6, 21, 9, 0)
  const trigger = nextReminderTrigger(pref({ checkInTime: '08:00' }), now, false)
  expect(trigger).toEqual(new Date(2026, 6, 22, 8, 0))
})

test('already checked in today, before today\'s time → still rolls to tomorrow', () => {
  const now = new Date(2026, 6, 21, 6, 0)
  const trigger = nextReminderTrigger(pref({ checkInTime: '08:00' }), now, true)
  expect(trigger).toEqual(new Date(2026, 6, 22, 8, 0))
})

test('exactly at today\'s time counts as due, not upcoming — rolls to tomorrow', () => {
  const now = new Date(2026, 6, 21, 8, 0)
  const trigger = nextReminderTrigger(pref({ checkInTime: '08:00' }), now, false)
  expect(trigger).toEqual(new Date(2026, 6, 22, 8, 0))
})

// ── DST safety ────────────────────────────────────────────────────────────
//
// America/New_York springs forward 2026-03-08 02:00 → 03:00. Rolling from
// 2026-03-07 to 2026-03-08 must keep the reminder at 08:00 local time, not
// preserve the UTC instant (which would land it at 09:00 local). Comparing
// getHours()/getMinutes() rather than getTime() is what proves the rollover
// is DST-safe.
const ORIGINAL_TZ = process.env.TZ

function withTimezone(tz: string) {
  process.env.TZ = tz
}

beforeEach(() => {
  ORIGINAL_TZ === undefined ? delete process.env.TZ : (process.env.TZ = ORIGINAL_TZ)
})

afterEach(() => {
  ORIGINAL_TZ === undefined ? delete process.env.TZ : (process.env.TZ = ORIGINAL_TZ)
})

test('rolling over a DST spring-forward keeps the same local check-in time', () => {
  withTimezone('America/New_York')

  const beforeDst = new Date(2026, 2, 7, 8, 0) // Sat Mar 7 2026, 08:00 EST (UTC-5)
  const trigger = nextReminderTrigger(pref({ checkInTime: '08:00' }), beforeDst, true)

  expect(trigger).not.toBeNull()
  expect(trigger!.getFullYear()).toBe(2026)
  expect(trigger!.getMonth()).toBe(2)
  expect(trigger!.getDate()).toBe(8)
  expect(trigger!.getHours()).toBe(8)
  expect(trigger!.getMinutes()).toBe(0)
  // The UTC offset actually changed (EST → EDT) — proof this crossed the
  // DST boundary rather than the test running somewhere DST doesn't apply.
  expect(trigger!.getTimezoneOffset()).not.toBe(beforeDst.getTimezoneOffset())
})
