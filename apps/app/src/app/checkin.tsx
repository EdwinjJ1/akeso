import type { CaffeineIntake, Scale1to5 } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { ChipRow, Tag, type ChipOption } from '@/components/ui/chips'
import { Mascot } from '@/components/mascot'
import { Screen } from '@/components/ui/screen'
import { useAppState } from '@/state/app-state'
import { todayISO } from '@/utils/dates'
import { colors, radius, sp, type } from '@/theme/tokens'

const SLEEP_HOUR_OPTIONS: ChipOption<number>[] = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(
  (hours) => ({ value: hours, label: `${hours}h` })
)

const scaleOptions = (labels: [string, string, string, string, string]): ChipOption<Scale1to5>[] =>
  labels.map((label, index) => ({ value: (index + 1) as Scale1to5, label }))

const QUALITY_OPTIONS = scaleOptions(['Rough', 'Poor', 'OK', 'Good', 'Great'])
const MOOD_OPTIONS = scaleOptions(['Low', 'Meh', 'OK', 'Good', 'Great'])
const STRESS_OPTIONS = scaleOptions(['Very low', 'Low', 'Medium', 'High', 'Very high'])
const ENERGY_OPTIONS = scaleOptions(['Drained', 'Low', 'OK', 'Good', 'Charged'])

const CAFFEINE_OPTIONS: ChipOption<CaffeineIntake>[] = [
  { value: 'none', label: 'None' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

export default function CheckIn() {
  const { submitCheckIn } = useAppState()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sleepHours, setSleepHours] = useState<number | null>(null)
  const [sleepQuality, setSleepQuality] = useState<Scale1to5 | null>(null)
  const [mood, setMood] = useState<Scale1to5 | null>(null)
  const [stress, setStress] = useState<Scale1to5 | null>(null)
  const [energyNow, setEnergyNow] = useState<Scale1to5 | null>(null)
  const [caffeine, setCaffeine] = useState<CaffeineIntake | null>(null)
  const [notes, setNotes] = useState('')

  const complete =
    sleepHours !== null &&
    sleepQuality !== null &&
    mood !== null &&
    stress !== null &&
    energyNow !== null &&
    caffeine !== null

  const answeredCount = [sleepHours, sleepQuality, mood, stress, energyNow, caffeine]
    .filter((value) => value !== null).length

  const submit = async () => {
    if (!complete) return
    setSubmitting(true)
    setError(null)
    try {
      await submitCheckIn({
        date: todayISO(),
        sleepHours,
        sleepQuality,
        mood,
        stress,
        energyNow,
        caffeine,
        notes: notes.trim() || undefined,
      })
      router.back()
    } catch (submitError) {
      console.error('Check-in failed:', submitError)
      setError('Something went wrong — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>A SMALL PAUSE FOR YOURSELF</Text>
          <Text style={type.h1}>Daily check-in</Text>
          <View style={styles.timeHint}>
            <Tag label="~20 seconds" color={colors.primaryDark} background={colors.primarySoft} />
          </View>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>TODAY’S SIGNAL</Text>
          <Text style={styles.progressCount}>{answeredCount} / 6</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(answeredCount / 6) * 100}%` }]} />
        </View>
      </View>

      <Text style={styles.sectionMarker}>01 · REST</Text>
      <Text style={styles.question}>How many hours did you sleep?</Text>
      <ChipRow options={SLEEP_HOUR_OPTIONS} value={sleepHours} onChange={setSleepHours} />

      <Text style={styles.question}>How was the sleep itself?</Text>
      <ChipRow options={QUALITY_OPTIONS} value={sleepQuality} onChange={setSleepQuality} />

      <Text style={styles.sectionMarker}>02 · HEADSPACE</Text>
      <Text style={styles.question}>Mood right now?</Text>
      <ChipRow options={MOOD_OPTIONS} value={mood} onChange={setMood} />

      <Text style={styles.question}>Stress level?</Text>
      <ChipRow options={STRESS_OPTIONS} value={stress} onChange={setStress} />

      <Text style={styles.sectionMarker}>03 · FUEL</Text>
      <Text style={styles.question}>Energy right now?</Text>
      <ChipRow options={ENERGY_OPTIONS} value={energyNow} onChange={setEnergyNow} />

      <Text style={styles.question}>Caffeine today (or planned)?</Text>
      <ChipRow options={CAFFEINE_OPTIONS} value={caffeine} onChange={setCaffeine} />

      <Text style={styles.question}>Anything else? (optional)</Text>
      <TextInput
        style={styles.notes}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. big deadline tomorrow"
        placeholderTextColor={colors.textMuted}
        maxLength={280}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.finishPanel, complete && styles.finishPanelReady]}>
        <View style={styles.finishCopy}>
          <Text style={styles.finishKicker}>{complete ? 'ALL SIGNALS IN' : 'ALMOST THERE'}</Text>
          <Text style={styles.finishTitle}>
            {complete ? 'Let’s shape your day.' : `${6 - answeredCount} quick answers left.`}
          </Text>
        </View>
        <Mascot state={complete ? 'celebrate' : 'steady'} size={112} />
      </View>

      <View style={styles.footer}>
        <Button
          label={complete ? 'Get my energy plan' : 'Answer all questions to continue'}
          onPress={submit}
          disabled={!complete}
          loading={submitting}
          variant="cta"
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: sp(2),
  },
  eyebrow: { ...type.label, color: colors.primaryDark, marginBottom: sp(2) },
  headerText: {
    flex: 1,
  },
  timeHint: {
    flexDirection: 'row',
    marginTop: sp(2),
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    backgroundColor: colors.text,
    borderRadius: 20,
    borderTopRightRadius: 6,
    padding: sp(4),
    marginTop: sp(4),
    marginBottom: sp(3),
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp(2) },
  progressLabel: { ...type.label, color: colors.lime },
  progressCount: { fontSize: 12, fontWeight: '900', color: colors.surface },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: '#40433C', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.lime },
  sectionMarker: { ...type.label, color: colors.primaryDark, marginTop: sp(7), marginBottom: -sp(3) },
  question: {
    ...type.h3,
    marginTop: sp(6),
    marginBottom: sp(2.5),
  },
  notes: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    paddingHorizontal: sp(4),
    paddingVertical: sp(3),
    fontSize: 15,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  error: {
    ...type.body,
    color: colors.danger,
    marginTop: sp(4),
  },
  finishPanel: {
    marginTop: sp(8),
    minHeight: 142,
    backgroundColor: colors.blue,
    borderRadius: 26,
    borderBottomRightRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  finishPanelReady: { backgroundColor: colors.primary },
  finishCopy: { flex: 1, zIndex: 2 },
  finishKicker: { ...type.label, color: colors.text },
  finishTitle: { ...type.h2, marginTop: sp(2), maxWidth: 190 },
  footer: {
    marginTop: sp(8),
  },
})
