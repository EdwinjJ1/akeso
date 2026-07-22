import { deriveReminderState, type ReminderPreference } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import {
  getReminderPermission,
  requestReminderPermission,
  type ReminderPermission,
} from '@/services/notifications'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp } from '@/theme/tokens'
import { formatHourLabel, shiftTime, todayISO } from '@/utils/dates'

const DEFAULT_CHECK_IN_TIME = '08:00'
const STEP_MINUTES = 15

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Always rendered on the dashboard (Issue #20: "App 内始终可见") — reminders
 * are set up and reflected here regardless of whether push is authorized.
 * Push, when granted, is just an additional channel for the same state.
 */
export function ReminderCard() {
  const { reminder, energy, saveReminderPreference } = useAppState()
  const [permission, setPermission] = useState<ReminderPermission>('undetermined')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    getReminderPermission().then(setPermission)
  }, [])

  // Guard on the date, not just presence: state.energy persists across
  // renders, so if the app is left open past midnight it still holds
  // yesterday's result. Without this guard the banner would read "done"
  // while the dashboard hero (which applies the same guard) correctly shows
  // today's check-in as still pending.
  const hasCheckedInToday = energy?.date === todayISO()
  const bannerState = deriveReminderState({
    preference: reminder,
    hasCheckedInToday,
    now: new Date(),
  })

  const enabled = reminder?.enabled ?? false
  const checkInTime = reminder?.checkInTime ?? DEFAULT_CHECK_IN_TIME

  async function commit(next: ReminderPreference) {
    setSaving(true)
    setSaveError(null)
    try {
      await saveReminderPreference(next)
      setPermission(await getReminderPermission())
    } catch {
      setSaveError("Couldn't save that — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(next: boolean) {
    if (next) {
      setPermission(await requestReminderPermission())
    }
    await commit({ enabled: next, checkInTime, timezone: deviceTimezone() })
  }

  async function handleShift(deltaMinutes: number) {
    await commit({
      enabled: true,
      checkInTime: shiftTime(checkInTime, deltaMinutes),
      timezone: deviceTimezone(),
    })
  }

  const statusCopy =
    bannerState.kind === 'done'
      ? 'Checked in today — no more nudges until tomorrow.'
      : bannerState.kind === 'due'
        ? "It's time — you haven't checked in yet today."
        : bannerState.kind === 'scheduled'
          ? `We'll remind you at ${formatHourLabel(bannerState.checkInTime)}.`
          : 'Turn on to get a daily nudge to check in.'

  return (
    <Card tone="quiet" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications" size={18} color={colors.text} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Daily reminder</Text>
          <Text style={styles.subtitle}>{statusCopy}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={saving}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>

      {enabled ? (
        <View style={styles.timeRow}>
          <Pressable
            onPress={() => handleShift(-STEP_MINUTES)}
            disabled={saving}
            style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
            accessibilityRole="button"
            accessibilityLabel="Earlier"
          >
            <Ionicons name="remove" size={16} color={colors.text} />
          </Pressable>
          <Text style={styles.timeLabel}>{formatHourLabel(checkInTime)}</Text>
          <Pressable
            onPress={() => handleShift(STEP_MINUTES)}
            disabled={saving}
            style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
            accessibilityRole="button"
            accessibilityLabel="Later"
          >
            <Ionicons name="add" size={16} color={colors.text} />
          </Pressable>
        </View>
      ) : null}

      {enabled && permission === 'denied' ? (
        <Text style={styles.permissionNote}>
          Push isn’t authorized on this device — you’ll still see this reminder in the app.
        </Text>
      ) : null}

      {saveError ? <Text style={styles.errorNote}>{saveError}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { paddingVertical: sp(4) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: sp(3) },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(4),
    marginTop: sp(4),
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { transform: [{ translateY: 1 }] },
  timeLabel: { fontSize: 17, fontWeight: '800', color: colors.text, minWidth: 72, textAlign: 'center' },
  permissionNote: {
    marginTop: sp(3),
    fontSize: 12,
    color: colors.warning,
    lineHeight: 16,
  },
  errorNote: {
    marginTop: sp(3),
    fontSize: 12,
    color: colors.danger,
    lineHeight: 16,
  },
})
