import type {
  Hydration,
  LastMealTiming,
  Scale1to5,
  SleepDuration,
} from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import {
  STEP_COUNT,
  buildCheckInInput,
  isStepAnswered,
  isTodaysCheckIn,
  nextStep,
  prevStep,
  progressRatio,
  shouldShowContinue,
  type CheckInAnswers,
} from '../state/checkin-logic'
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

const STEP_META = [
  { marker: '01 - ENERGY', question: "How's your energy right now?" },
  { marker: '02 - REST', question: 'How much sleep did you get last night?' },
  { marker: '03 - FUEL', question: 'When did you last eat?' },
  { marker: '04 - WATER', question: 'How much water so far today?' },
] as const

/** One-question-per-step daily check-in. Chip taps advance automatically so
 * the whole thing takes about 20 seconds, except the optional meal note. */
export default function CheckIn() {
  const { latestCheckIn, submitCheckIn } = useAppState()
  const [step, setStep] = useState(0)
  // Captured once and sent as explicit input so the Domain engine never
  // reads wall-clock time during scoring or replay.
  const [localHour] = useState(() => new Date().getHours())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A check-in left over from a previous day (app open across midnight) is
  // treated as fresh: it neither pre-fills answers nor flips the header copy.
  const prefill = isTodaysCheckIn(latestCheckIn, todayISO()) ? latestCheckIn : null

  const [reportedEnergy, setReportedEnergy] = useState<Scale1to5 | null>(
    prefill?.reportedEnergy ?? null
  )
  const [sleepDuration, setSleepDuration] = useState<SleepDuration | null>(
    prefill?.sleepDuration ?? null
  )
  const [lastMealTiming, setLastMealTiming] = useState<LastMealTiming | null>(
    prefill?.lastMealTiming ?? null
  )
  const [lastMealDescription, setLastMealDescription] = useState(
    prefill?.lastMealDescription ?? ''
  )
  const [hydration, setHydration] = useState<Hydration | null>(
    prefill?.hydration ?? null
  )

  const answers: CheckInAnswers = {
    reportedEnergy,
    sleepDuration,
    lastMealTiming,
    lastMealDescription,
    hydration,
  }

  const isUpdate = prefill !== null
  const complete = buildCheckInInput(answers, todayISO(), localHour) !== null
  const isLastStep = step === STEP_COUNT - 1

  const closeCheckIn = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }

  const goNext = () => {
    setError(null)
    setStep((current) => nextStep(current))
  }

  const goBack = () => {
    setError(null)
    if (step === 0) closeCheckIn()
    else setStep((current) => prevStep(current))
  }

  const onEnergy = (value: Scale1to5) => {
    setReportedEnergy(value)
    goNext()
  }

  const onSleep = (value: SleepDuration) => {
    setSleepDuration(value)
    goNext()
  }

  const submit = async () => {
    const input = buildCheckInInput(answers, todayISO(), localHour)
    if (!input) return
    setSubmitting(true)
    setError(null)
    try {
      await submitCheckIn(input)
      closeCheckIn()
    } catch (submitError) {
      console.error('Check-in failed:', submitError)
      setError('Something went wrong — please try again.')
      setSubmitting(false)
    }
  }

  const current = STEP_META[step]
  const currentStepAnswered = isStepAnswered(step, answers)
  const showContinue = shouldShowContinue(step, answers)
  const helperText = (() => {
    if (!currentStepAnswered) {
      if (step === 2) return 'Pick when you last ate to continue.'
      if (isLastStep) return 'Pick your water intake to finish.'
      return 'Pick an answer to continue.'
    }

    if (step <= 1) {
      return isUpdate ? 'Change it, or keep the previous answer.' : 'Tap an answer to continue.'
    }

    return null
  })()

  return (
    <Screen>
      <View style={styles.controls}>
        <Pressable
          onPress={goBack}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Close check-in' : 'Previous question'}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={closeCheckIn}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>A SMALL PAUSE FOR YOURSELF</Text>
        <Text style={type.h1}>{isUpdate ? "Update today's status" : 'Daily check-in'}</Text>
        <View style={styles.timeHint}>
          <Tag label="~20 seconds" color={colors.primaryDark} background={colors.primarySoft} />
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{"TODAY'S SIGNAL"}</Text>
          <Text style={styles.progressCount}>
            Step {step + 1} / {STEP_COUNT}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressRatio(step, answers) * 100}%` }]}
          />
        </View>
      </View>

      <Text style={styles.sectionMarker}>{current.marker}</Text>
      <Text style={styles.question}>{current.question}</Text>

      {step === 0 ? (
        <ChipRow options={ENERGY_OPTIONS} value={reportedEnergy} onChange={onEnergy} />
      ) : null}

      {step === 1 ? (
        <ChipRow options={SLEEP_OPTIONS} value={sleepDuration} onChange={onSleep} />
      ) : null}

      {step === 2 ? (
        <>
          <ChipRow options={MEAL_OPTIONS} value={lastMealTiming} onChange={setLastMealTiming} />
          <Text style={styles.optionalQuestion}>What was it? (optional)</Text>
          <TextInput
            style={styles.mealInput}
            value={lastMealDescription}
            onChangeText={setLastMealDescription}
            placeholder="e.g. leftover salmon rice bowl"
            placeholderTextColor={colors.textMuted}
            maxLength={280}
            multiline
          />
        </>
      ) : null}

      {step === 3 ? (
        <ChipRow options={HYDRATION_OPTIONS} value={hydration} onChange={setHydration} />
      ) : null}

      {helperText ? <Text style={styles.hint}>{helperText}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLastStep ? (
        <View style={[styles.finishPanel, complete && styles.finishPanelReady]}>
          <View style={styles.finishCopy}>
            <Text style={styles.finishKicker}>{complete ? 'ALL SIGNALS IN' : 'ONE LAST ANSWER'}</Text>
            <Text style={styles.finishTitle}>
              {complete ? "Let's shape your day." : 'How much water so far?'}
            </Text>
          </View>
          <Mascot state={complete ? 'celebrate' : 'steady'} size={112} />
        </View>
      ) : null}

      {showContinue ? (
        <View style={styles.footer}>
          <Button
            label={isUpdate && step !== 2 ? 'Keep this answer' : 'Continue'}
            onPress={goNext}
            disabled={!currentStepAnswered}
            variant="cta"
          />
        </View>
      ) : null}

      {isLastStep ? (
        <View style={styles.footer}>
          <Button
            label={
              complete
                ? isUpdate
                  ? 'Update my energy score'
                  : 'Get my energy plan'
                : 'Pick one to continue'
            }
            onPress={submit}
            disabled={!complete}
            loading={submitting}
            variant="cta"
          />
        </View>
      ) : null}

      <Text style={styles.disclaimer}>
        Akeso estimates your daily energy from your own check-in; it is not medical advice.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(2),
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginTop: sp(2),
  },
  eyebrow: { ...type.label, color: colors.primaryDark, marginBottom: sp(2) },
  timeHint: {
    flexDirection: 'row',
    marginTop: sp(2),
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
  optionalQuestion: {
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
  hint: {
    ...type.small,
    color: colors.textMuted,
    marginTop: sp(4),
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
  disclaimer: {
    ...type.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: sp(6),
  },
})
