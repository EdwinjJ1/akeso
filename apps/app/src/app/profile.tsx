import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReminderPreference } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { Mascot } from '@/components/mascot'
import { Button } from '@/components/ui/buttons'
import { Screen } from '@/components/ui/screen'
import { getService } from '@/services'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

const TIMEZONE_STORAGE_KEY = 'akeso.timezone'
const REMINDER_TIMES = ['07:00', '08:00', '09:00', '10:00', '18:00', '20:00']
const TIMEZONES = [
  'Australia/Melbourne',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Perth',
  'Pacific/Auckland',
]

function detectedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne'
}

export default function Profile() {
  const { profile } = useAppState()
  const service = getService()
  const [timezone, setTimezone] = useState(detectedTimezone())
  const [reminder, setReminder] = useState<ReminderPreference>(() => ({ enabled: false, checkInTime: '09:00', timezone: detectedTimezone() }))
  const [showTimezones, setShowTimezones] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([service.getReminderPreference(), AsyncStorage.getItem(TIMEZONE_STORAGE_KEY)])
      .then(([savedReminder, savedTimezone]) => {
        if (!active) return
        if (savedReminder) {
          setReminder(savedReminder)
          setTimezone(savedReminder.timezone)
        }
        if (savedTimezone && !savedReminder) {
          setTimezone(savedTimezone)
          setReminder((value) => ({ ...value, timezone: savedTimezone }))
        }
      })
      .catch(() => active && setError('Could not load all settings.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [service])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await Promise.all([
        service.saveReminderPreference({ ...reminder, timezone }),
        AsyncStorage.setItem(TIMEZONE_STORAGE_KEY, timezone),
      ])
      setSaved(true)
    } catch {
      setError('Settings could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const initial = (profile?.displayName ?? 'A').slice(0, 1).toUpperCase()

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>MY AKESO</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{profile?.displayName ?? 'Your profile'}</Text>
          <Text style={styles.profileMeta}>
            {profile ? `${profile.goal} goal · ${profile.typicalWake} wake-up` : 'Your daily energy companion'}
          </Text>
        </View>
        <Mascot state="celebrate" size={96} />
      </View>

      <View style={styles.headingRow}>
        <View><Text style={styles.kicker}>MAKE IT YOURS</Text><Text style={type.h1}>Settings</Text></View>
        <Ionicons name="options" size={26} color={colors.text} />
      </View>

      {loading ? (
        <View style={styles.loadingRow}><ActivityIndicator color={colors.text} /><Text style={styles.muted}>Loading your settings…</Text></View>
      ) : (
        <>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.lime }]}><Ionicons name="notifications" size={20} color={colors.text} /></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Daily reminder</Text>
                <Text style={styles.settingDescription}>A gentle nudge to check in each day.</Text>
              </View>
              <Switch accessibilityLabel="Daily reminder" onValueChange={(enabled) => setReminder((value) => ({ ...value, enabled }))} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={reminder.enabled ? colors.lime : colors.surface} value={reminder.enabled} />
            </View>

            {reminder.enabled ? (
              <View style={styles.optionSection}>
                <Text style={styles.optionLabel}>REMIND ME AT</Text>
                <View style={styles.chipRow}>
                  {REMINDER_TIMES.map((time) => (
                    <Pressable accessibilityRole="button" key={time} onPress={() => setReminder((value) => ({ ...value, checkInTime: time }))} style={({ pressed }) => [styles.chip, reminder.checkInTime === time && styles.chipSelected, pressed && styles.pressed]}>
                      <Text style={[styles.chipText, reminder.checkInTime === time && styles.chipTextSelected]}>{time}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.settingCard}>
            <Pressable accessibilityHint="Shows timezone choices" accessibilityRole="button" onPress={() => setShowTimezones((value) => !value)} style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}>
              <View style={[styles.settingIcon, { backgroundColor: colors.blue }]}><Ionicons name="globe" size={20} color={colors.text} /></View>
              <View style={styles.settingCopy}><Text style={styles.settingTitle}>Timezone</Text><Text style={styles.settingDescription}>{timezone.replaceAll('_', ' ')}</Text></View>
              <Ionicons name={showTimezones ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
            </Pressable>

            {showTimezones ? (
              <View style={styles.timezoneList}>
                {Array.from(new Set([detectedTimezone(), ...TIMEZONES])).map((zone) => {
                  const selected = zone === timezone
                  return (
                    <Pressable accessibilityRole="button" key={zone} onPress={() => { setTimezone(zone); setReminder((value) => ({ ...value, timezone: zone })); setShowTimezones(false) }} style={({ pressed }) => [styles.timezoneRow, pressed && styles.rowPressed]}>
                      <View><Text style={styles.timezoneName}>{zone.replaceAll('_', ' ')}</Text>{zone === detectedTimezone() ? <Text style={styles.detected}>DEVICE TIMEZONE</Text> : null}</View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.settingCard}>
            <Pressable accessibilityHint="Opens account and sign-in settings" accessibilityRole="button" onPress={() => router.push('../account')} style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}>
              <View style={[styles.settingIcon, { backgroundColor: colors.lime }]}><Ionicons name="cloud-done" size={20} color={colors.text} /></View>
              <View style={styles.settingCopy}><Text style={styles.settingTitle}>Account & sync</Text><Text style={styles.settingDescription}>Keep your profile when you change devices.</Text></View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {saved ? <Text accessibilityRole="alert" style={styles.saved}>Settings saved.</Text> : null}
          <Button label="Save settings" loading={saving} onPress={save} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp(5) },
  iconButton: { width: 44, height: 44, borderWidth: 1.5, borderColor: colors.text, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  topTitle: { ...type.label, color: colors.text }, topSpacer: { width: 44 }, pressed: { transform: [{ translateY: 2 }] }, rowPressed: { opacity: 0.72 },
  profileCard: { minHeight: 148, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.text, borderRadius: radius.xl, borderBottomRightRadius: 8, paddingLeft: sp(4), overflow: 'hidden', marginBottom: sp(8), shadowColor: colors.text, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } },
  avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] }, avatarText: { color: colors.lime, fontWeight: '900', fontSize: 22 },
  profileCopy: { flex: 1, paddingLeft: sp(3) }, name: { color: colors.text, fontSize: 23, lineHeight: 27, fontWeight: '900' }, profileMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: sp(1), textTransform: 'capitalize' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: sp(4) }, kicker: { ...type.label, marginBottom: sp(1) },
  loadingRow: { alignItems: 'center', gap: sp(2), paddingVertical: sp(8) }, muted: { ...type.small, color: colors.textSecondary },
  settingCard: { backgroundColor: colors.surface, borderColor: colors.text, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: sp(3), overflow: 'hidden' },
  settingRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: sp(3.5), gap: sp(3) }, settingIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderColor: colors.text, borderRadius: 15, borderWidth: 1.5 },
  settingCopy: { flex: 1 }, settingTitle: { color: colors.text, fontSize: 16, fontWeight: '900' }, settingDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  optionSection: { borderTopWidth: 1.5, borderTopColor: colors.border, padding: sp(3.5) }, optionLabel: { ...type.label, color: colors.textSecondary, marginBottom: sp(2.5) }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2) },
  chip: { minWidth: 65, paddingHorizontal: sp(3), paddingVertical: sp(2.5), borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.bg, alignItems: 'center' }, chipSelected: { backgroundColor: colors.text }, chipText: { color: colors.text, fontSize: 13, fontWeight: '800' }, chipTextSelected: { color: colors.lime },
  timezoneList: { borderTopWidth: 1.5, borderTopColor: colors.border }, timezoneRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sp(4), paddingVertical: sp(2.5), borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, timezoneName: { color: colors.text, fontSize: 14, fontWeight: '800' }, detected: { ...type.label, fontSize: 9, color: colors.primaryDark, marginTop: 3 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginBottom: sp(3) }, saved: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginBottom: sp(3) },
})
