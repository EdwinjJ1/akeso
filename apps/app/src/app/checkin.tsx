import type { Hydration, LastMealTiming, Scale1to5, SleepDuration } from '@akeso/domain'
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

const scaleOptions = (labels: [string, string, string, string, string]): ChipOption<Scale1to5>[] =>
  labels.map((label, index) => ({ value: (index + 1) as Scale1to5, label }))

const ENERGY_OPTIONS = scaleOptions(['Drained', 'Low', 'OK', 'Good', 'Charged'])

const SLEEP_OPTIONS: ChipOption<SleepDuration>[] = [
  { value: 'under_5h', label: 'Under 5h' },
  { value: '5_6h', label: '5–6h' },
  { value: '6_7h', label: '6–7h' },
  { value: '7_8h', label: '7–8h' },
  { value: '8_9h', label: '8–9h' },
  { value: 'over_9h', label: 'Over 9h' },
  { value: 'not_sure', label: 'Not sure' },
]

const MEAL_OPTIONS: ChipOption<LastMealTiming>[] = [
  { value: 'within_1h', label: 'Within 1h' },
  { value: '1_3h', label: '1–3h ago' },
  { value: '3_5h', label: '3–5h ago' },
  { value: 'over_5h', label: 'Over 5h ago' },
  { value: 'not_today', label: 'Not yet today' },
  { value: 'not_sure', label: 'Not sure' },
]

const HYDRATION_OPTIONS: ChipOption<Hydration>[] = [
  { value: 'under_0_5l', label: 'Under 0.5L' },
  { value: '0_5_1l', label: '0.5–1L' },
  { value: '1_1_5l', label: '1–1.5L' },
  { value: '1_5_2l', label: '1.5–2L' },
  { value: 'over_2l', label: 'Over 2L' },
  { value: 'not_sure', label: 'Not sure' },
]

export default function CheckIn() {
  const { submitCheckIn } = useAppState()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reportedEnergy, setReportedEnergy] = useState<Scale1to5 | null>(null)
  const [sleepDuration, setSleepDuration] = useState<SleepDuration | null>(null)
  const [lastMealTiming, setLastMealTiming] = useState<LastMealTiming | null>(null)
  const [lastMealDescription, setLastMealDescription] = useState('')
  const [hydration, setHydration] = useState<Hydration | null>(null)

  const complete =
    reportedEnergy !== null &&
    sleepDuration !== null &&
    lastMealTiming !== null &&
    hydration !== null

  const answeredCount = [reportedEnergy, sleepDuration, lastMealTiming, hydration]
    .filter((value) => value !== null).length

  const submit = async () => {
    if (!complete) return
    setSubmitting(true)
    setError(null)
    try {
      await submitCheckIn({
        date: todayISO(),
        reportedEnergy,
        sleepDuration,
        lastMealTiming,
        lastMealDescription: lastMealDescription.trim() || undefined,
        hydration,
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
          <Text style={styles.progressCount}>{answeredCount} / 4</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(answeredCount / 4) * 100}%` }]} />
        </View>
      </View>

      <Text style={styles.sectionMarker}>01 · ENERGY</Text>
      <Text style={styles.question}>How’s your energy right now?</Text>
      <ChipRow options={ENERGY_OPTIONS} value={reportedEnergy} onChange={setReportedEnergy} />

      <Text style={styles.sectionMarker}>02 · REST</Text>
      <Text style={styles.question}>How much sleep did you get last night?</Text>
      <ChipRow options={SLEEP_OPTIONS} value={sleepDuration} onChange={setSleepDuration} />

      <Text style={styles.sectionMarker}>03 · FUEL</Text>
      <Text style={styles.question}>When did you last eat?</Text>
      <ChipRow options={MEAL_OPTIONS} value={lastMealTiming} onChange={setLastMealTiming} />

      <Text style={styles.question}>What was it? (optional)</Text>
      <TextInput
        style={styles.mealInput}
        value={lastMealDescription}
        onChangeText={setLastMealDescription}
        placeholder="e.g. leftover salmon rice bowl"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={styles.sectionMarker}>04 · WATER</Text>
      <Text style={styles.question}>How much water so far today?</Text>
      <ChipRow options={HYDRATION_OPTIONS} value={hydration} onChange={setHydration} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.finishPanel, complete && styles.finishPanelReady]}>
        <View style={styles.finishCopy}>
          <Text style={styles.finishKicker}>{complete ? 'ALL SIGNALS IN' : 'ALMOST THERE'}</Text>
          <Text style={styles.finishTitle}>
            {complete ? 'Let’s shape your day.' : `${4 - answeredCount} quick answers left.`}
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
  mealInput: {
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
