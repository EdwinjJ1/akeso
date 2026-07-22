import { nextReminderTrigger, type ReminderPreference } from '@akeso/domain'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

/**
 * expo-notifications has no web implementation — every export here is a
 * safe no-op on web so callers (the reminder card, app-state) don't need
 * their own Platform checks. The app-internal banner (deriveReminderState)
 * still works on web; only the OS push notification is unavailable.
 */
const SUPPORTS_LOCAL_NOTIFICATIONS = Platform.OS !== 'web'

if (SUPPORTS_LOCAL_NOTIFICATIONS) {
  // Foreground behavior — without a handler, iOS silently drops
  // notifications that fire while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

export type ReminderPermission = 'granted' | 'denied' | 'undetermined'

function toReminderPermission(response: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (response.granted) return 'granted'
  return response.canAskAgain ? 'undetermined' : 'denied'
}

/** Current permission state, without prompting. */
export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return 'denied'
  return toReminderPermission(await Notifications.getPermissionsAsync())
}

/** Prompts once; a prior denial that disabled re-asking resolves straight to 'denied'. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return 'denied'
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return 'granted'
  if (!current.canAskAgain) return 'denied'
  return toReminderPermission(await Notifications.requestPermissionsAsync())
}

const REMINDER_CONTENT = {
  title: 'Time for your daily check-in',
  body: "Takes about 20 seconds — tap to log today's energy.",
}

/**
 * Cancels whatever was scheduled and, if reminders are on and permission is
 * granted, schedules the single next occurrence. Always cancel-then-reschedule
 * rather than track an id — a changed time, a completed check-in, or a
 * flipped-off preference all invalidate whatever was scheduled before, and
 * this app never schedules any other kind of local notification.
 *
 * A no-op when permission isn't granted — the in-app banner (see
 * @akeso/domain's deriveReminderState) is what covers that case instead.
 *
 * Every caller treats this as a best-effort side effect alongside a
 * primary operation that has already succeeded (a check-in was saved, a
 * preference was saved, today's data was loaded) — so this never throws.
 * A scheduling failure only means the OS notification might be stale; it
 * must never make an already-successful primary action look like it failed.
 */
export async function syncReminderSchedule(
  preference: ReminderPreference,
  hasCheckedInToday: boolean
): Promise<void> {
  if (!SUPPORTS_LOCAL_NOTIFICATIONS) return

  try {
    await Notifications.cancelAllScheduledNotificationsAsync()

    const trigger = nextReminderTrigger(preference, new Date(), hasCheckedInToday)
    if (!trigger) return

    const permission = await Notifications.getPermissionsAsync()
    if (!permission.granted) return

    await Notifications.scheduleNotificationAsync({
      content: REMINDER_CONTENT,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    })
  } catch (error) {
    console.error('syncReminderSchedule failed:', error)
  }
}
