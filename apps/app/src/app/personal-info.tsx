import type {
  DietaryPreference,
  DietarySafetyProfile,
  FoodAllergen,
  UserGoal,
} from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { ChipRow, MultiChipRow } from '@/components/ui/chips'
import { Screen } from '@/components/ui/screen'
import {
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  GOAL_OPTIONS,
  listFromText,
  SLEEP_OPTIONS,
  WAKE_OPTIONS,
} from '@/services/profile-options'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'
import { getOnboardingErrorMessage } from '@/utils/onboarding-error'

/**
 * Edit the saved personal profile. Onboarding (welcome.tsx) creates it; this
 * screen is the in-app editor for the same UserProfile, saved through the
 * same completeOnboarding → PUT /v1/profile path.
 */
export default function PersonalInfo() {
  const { profile, completeOnboarding } = useAppState()

  const [name, setName] = useState(profile?.displayName ?? '')
  const [goal, setGoal] = useState<UserGoal | null>(profile?.goal ?? null)
  const [wake, setWake] = useState<string | null>(profile?.typicalWake ?? '07:00')
  const [sleep, setSleep] = useState<string | null>(profile?.typicalSleep ?? '23:00')
  const [diet, setDiet] = useState<DietaryPreference | null>(
    profile?.dietaryPreference ?? 'none'
  )
  const [allergens, setAllergens] = useState<FoodAllergen[]>(
    profile?.dietarySafety.allergens ?? []
  )
  const [avoidIngredientsText, setAvoidIngredientsText] = useState(
    (profile?.dietarySafety.avoidIngredients ?? []).join(', ')
  )
  const [safetyNotes, setSafetyNotes] = useState(profile?.dietarySafety.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wake/sleep values saved before these fixed options existed still render.
  const timeOptions = (options: string[], current: string | null) =>
    (current && !options.includes(current) ? [...options, current] : options).map(
      (time) => ({ value: time, label: time })
    )

  const save = async () => {
    if (!goal || !wake || !sleep || !diet) return
    const dietarySafety: DietarySafetyProfile = {
      allergens,
      avoidIngredients: listFromText(avoidIngredientsText),
      ...(safetyNotes.trim() ? { notes: safetyNotes.trim() } : {}),
    }
    setSaving(true)
    setError(null)
    try {
      await completeOnboarding({
        displayName: name.trim() || 'there',
        goal,
        typicalWake: wake,
        typicalSleep: sleep,
        dietaryPreference: diet,
        dietarySafety,
      })
      router.back()
    } catch (cause) {
      setError(getOnboardingErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>ABOUT YOU</Text>
        <View style={styles.topSpacer} />
      </View>

      <Text style={type.h1}>Your personal info</Text>
      <Text style={styles.subtitle}>
        Akeso uses this to shape your plan and meal ideas — nothing is shared.
      </Text>

      <Text style={styles.fieldLabel}>Name</Text>
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

      <Text style={styles.fieldLabel}>I usually wake up around</Text>
      <ChipRow options={timeOptions(WAKE_OPTIONS, wake)} value={wake} onChange={setWake} />

      <Text style={styles.fieldLabel}>I usually sleep around</Text>
      <ChipRow options={timeOptions(SLEEP_OPTIONS, sleep)} value={sleep} onChange={setSleep} />

      <Text style={styles.fieldLabel}>Dietary preference</Text>
      <ChipRow options={DIET_OPTIONS} value={diet} onChange={setDiet} />

      <Text style={styles.fieldLabel}>Food allergies Akeso should avoid</Text>
      <MultiChipRow options={ALLERGEN_OPTIONS} values={allergens} onChange={setAllergens} />

      <Text style={styles.fieldLabel}>Other foods to avoid</Text>
      <TextInput
        style={styles.input}
        value={avoidIngredientsText}
        onChangeText={setAvoidIngredientsText}
        placeholder="e.g. banana, spicy food"
        placeholderTextColor={colors.textMuted}
        maxLength={280}
      />

      <Text style={styles.fieldLabel}>Additional safety requirement (optional)</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={safetyNotes}
        onChangeText={setSafetyNotes}
        placeholder="e.g. avoid cross-contamination"
        placeholderTextColor={colors.textMuted}
        maxLength={280}
        multiline
      />

      <View style={styles.footer}>
        {error ? (
          <Text accessibilityRole="alert" style={styles.saveError}>
            {error}
          </Text>
        ) : null}
        <Button
          label="Save changes"
          onPress={save}
          loading={saving}
          disabled={!goal || !wake || !sleep || !diet}
          variant="cta"
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(6),
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pressed: { transform: [{ translateY: 2 }] },
  topTitle: { ...type.label, color: colors.text },
  topSpacer: { width: 44 },
  subtitle: { ...type.body, marginTop: sp(2) },
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
  multilineInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  footer: { marginTop: sp(8) },
  saveError: {
    ...type.small,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: sp(3),
    textAlign: 'center',
  },
})
