import type { ReminderPreference } from './types.js'

/**
 * What the in-app reminder surface should show right now. Derived purely
 * from local wall-clock time, so it never disagrees with what a device-local
 * push notification would also decide (Issue #20 Phase 1 schedules
 * notifications on-device rather than from a server).
 */
export type ReminderBannerState =
  | { kind: 'disabled' }
  | { kind: 'scheduled'; checkInTime: string }
  | { kind: 'due'; checkInTime: string }
  | { kind: 'done' }

export interface ReminderContext {
  /** null until the user has ever saved a preference. */
  preference: ReminderPreference | null
  /** Whether an EnergyResult already exists for today's local date. */
  hasCheckedInToday: boolean
  /** The device's current time — always local wall-clock, never UTC-shifted. */
  now: Date
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function parseCheckInTime(checkInTime: string): number {
  const [hours, minutes] = checkInTime.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Completing today's check-in always wins: once it's done, the banner
 * reflects that regardless of preference or time of day, which is also what
 * makes "no more nagging after check-in" true independent of whether the
 * user disabled reminders in between.
 */
export function deriveReminderState(ctx: ReminderContext): ReminderBannerState {
  if (ctx.hasCheckedInToday) return { kind: 'done' }
  if (!ctx.preference || !ctx.preference.enabled) return { kind: 'disabled' }

  const isDue = minutesSinceMidnight(ctx.now) >= parseCheckInTime(ctx.preference.checkInTime)
  return isDue
    ? { kind: 'due', checkInTime: ctx.preference.checkInTime }
    : { kind: 'scheduled', checkInTime: ctx.preference.checkInTime }
}

/**
 * The next moment a local notification should fire, or null if reminders are
 * off. Always built from `now`'s local Y/M/D plus the preference's H/M —
 * never `now.getTime() + 24h` — so rolling to "tomorrow" keeps the same
 * local wall-clock time across a DST transition instead of drifting an hour.
 */
export function nextReminderTrigger(
  preference: ReminderPreference,
  now: Date,
  hasCheckedInToday: boolean
): Date | null {
  if (!preference.enabled) return null

  const [hours, minutes] = preference.checkInTime.split(':').map(Number)
  const todayTarget = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  )

  if (!hasCheckedInToday && todayTarget.getTime() > now.getTime()) {
    return todayTarget
  }

  const tomorrowTarget = new Date(todayTarget)
  tomorrowTarget.setDate(tomorrowTarget.getDate() + 1)
  return tomorrowTarget
}
