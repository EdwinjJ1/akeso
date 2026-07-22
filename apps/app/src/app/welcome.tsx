import type { DietaryPreference, UserGoal } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { ChipRow } from '@/components/ui/chips'
import { Mascot } from '@/components/mascot'
import { Reveal } from '@/components/ui/reveal'
import { Screen } from '@/components/ui/screen'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'
import { getOnboardingErrorMessage } from '@/utils/onboarding-error'

const GOAL_OPTIONS: { value: UserGoal; label: string }[] = [
  { value: 'academic', label: 'Study & exams' },
  { value: 'work', label: 'Work & career' },
  { value: 'fitness', label: 'Training & fitness' },
  { value: 'balance', label: 'Overall balance' },
]

const WAKE_OPTIONS = ['06:00', '06:30', '07:00', '07:30', '08:00', '09:00']
const SLEEP_OPTIONS = ['22:00', '22:30', '23:00', '23:30', '00:00', '01:00']

const DIET_OPTIONS: { value: DietaryPreference; label: string }[] = [
  { value: 'none', label: 'No preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal' },
  { value: 'gluten_free', label: 'Gluten-free' },
]

const VALUE_PROPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'flash', text: 'A 20-second check-in turns into your daily energy score' },
  { icon: 'calendar', text: 'Your hardest work lands in your best hours' },
  { icon: 'nutrition', text: 'Meals matched to what your body needs — from your own fridge' },
]

export default function Welcome() {
  const { completeOnboarding } = useAppState()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [goal, setGoal] = useState<UserGoal | null>(null)
  const [wake, setWake] = useState<string | null>('07:00')
  const [sleep, setSleep] = useState<string | null>('23:00')
  const [diet, setDiet] = useState<DietaryPreference | null>('none')

  const finish = async () => {
    if (!goal || !wake || !sleep || !diet) return
    setSaving(true)
    setSaveError(null)
    try {
      await completeOnboarding({
        displayName: name.trim() || 'there',
        goal,
        typicalWake: wake,
        typicalSleep: sleep,
        dietaryPreference: diet,
      })
      router.replace('/(tabs)')
    } catch (error) {
      console.error('completeOnboarding failed:', error)
      setSaveError(getOnboardingErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      {step > 0 ? (
        <View style={styles.progressRow}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={colors.textSecondary}
            onPress={() => setStep(step - 1)}
          />
          <View style={styles.dots}>
            {[1, 2].map((dotStep) => (
              <View
                key={dotStep}
                style={[styles.dot, step >= dotStep && styles.dotActive]}
              />
            ))}
          </View>
          <View style={{ width: 22 }} />
        </View>
      ) : null}

      {step === 0 ? (
        <View style={styles.hero}>
          <Reveal>
          <View style={styles.poster}>
            <Text style={styles.posterKicker}>AKESO · DAILY ENERGY</Text>
            <Text style={styles.posterTitle}>MEET YOUR DAY{`\n`}AT THE RIGHT{`\n`}ENERGY.</Text>
            <View style={styles.posterMascot}>
              <Mascot state="celebrate" size={190} />
            </View>
            <View style={styles.posterNote}>
              <Text style={styles.posterNoteText}>LESS GRIND.{`\n`}BETTER TIMING.</Text>
            </View>
          </View>
          </Reveal>

          <View style={styles.brandRow}>
            <View style={styles.logoSquare}>
              <Ionicons name="pulse" size={22} color={colors.text} />
            </View>
            <View>
              <Text style={styles.appName}>Akeso</Text>
              <Text style={styles.tagline}>Your personal energy coach</Text>
            </View>
          </View>

          <View style={styles.props}>
            {VALUE_PROPS.map((prop, index) => (
              <View key={prop.icon} style={styles.propRow}>
                <View style={styles.propIcon}>
                  <Text style={styles.propNumber}>0{index + 1}</Text>
                </View>
                <Text style={styles.propText}>{prop.text}</Text>
              </View>
            ))}
          </View>

          <Button label="Get started" onPress={() => setStep(1)} />
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={styles.stepIndex}>01 / 02</Text>
          <Text style={type.h1}>First, about you</Text>
          <Text style={styles.stepSubtitle}>
            Akeso uses this to shape your plan — nothing is shared.
          </Text>

          <Text style={styles.fieldLabel}>What should we call you?</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>What matters most right now?</Text>
          <ChipRow options={GOAL_OPTIONS} value={goal} onChange={setGoal} />

          <View style={styles.footer}>
            <Button label="Continue" onPress={() => setStep(2)} disabled={!goal} />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={styles.stepIndex}>02 / 02</Text>
          <Text style={type.h1}>Your usual rhythm</Text>
          <Text style={styles.stepSubtitle}>
            A rough baseline is enough — your daily check-in does the fine-tuning.
          </Text>

          <Text style={styles.fieldLabel}>I usually wake up around</Text>
          <ChipRow
            options={WAKE_OPTIONS.map((time) => ({ value: time, label: time }))}
            value={wake}
            onChange={setWake}
          />

          <Text style={styles.fieldLabel}>I usually sleep around</Text>
          <ChipRow
            options={SLEEP_OPTIONS.map((time) => ({ value: time, label: time }))}
            value={sleep}
            onChange={setSleep}
          />

          <Text style={styles.fieldLabel}>Any dietary preference?</Text>
          <ChipRow options={DIET_OPTIONS} value={diet} onChange={setDiet} />

          <View style={styles.footer}>
            {saveError ? (
              <Text accessibilityRole="alert" style={styles.saveError}>
                {saveError}
              </Text>
            ) : null}
            <Button label="Start using Akeso" onPress={finish} loading={saving} variant="cta" />
          </View>
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(6),
  },
  dots: {
    flexDirection: 'row',
    gap: sp(1.5),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  hero: {
    alignItems: 'stretch',
    paddingTop: sp(2),
  },
  poster: {
    minHeight: 430,
    backgroundColor: colors.text,
    borderRadius: 34,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    padding: sp(5),
    marginBottom: sp(5),
  },
  posterKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: colors.lime },
  posterTitle: {
    color: colors.surface,
    fontSize: 41,
    lineHeight: 40,
    letterSpacing: -1.8,
    fontWeight: '900',
    marginTop: sp(4),
    zIndex: 2,
  },
  posterMascot: { position: 'absolute', right: -28, bottom: -14 },
  posterNote: {
    position: 'absolute',
    left: sp(5),
    bottom: sp(5),
    backgroundColor: colors.lime,
    borderRadius: 14,
    paddingHorizontal: sp(3),
    paddingVertical: sp(2),
    transform: [{ rotate: '-3deg' }],
  },
  posterNoteText: { fontSize: 11, lineHeight: 14, fontWeight: '900', color: colors.text },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: sp(3), marginBottom: sp(7) },
  logoSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...type.h1,
    fontSize: 28,
  },
  tagline: {
    ...type.small,
  },
  props: {
    gap: 0,
    marginBottom: sp(7),
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    paddingVertical: sp(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  propIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propNumber: { fontSize: 11, fontWeight: '900', color: colors.text },
  propText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  stepSubtitle: {
    ...type.body,
    marginTop: sp(2),
    marginBottom: sp(4),
  },
  stepIndex: { ...type.label, color: colors.primaryDark, marginBottom: sp(2) },
  fieldLabel: {
    ...type.h3,
    marginTop: sp(5),
    marginBottom: sp(2.5),
  },
  input: {
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
    fontSize: 16,
    color: colors.text,
    minHeight: 50,
  },
  footer: {
    marginTop: sp(8),
  },
  saveError: {
    ...type.small,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: sp(3),
    textAlign: 'center',
  },
})
