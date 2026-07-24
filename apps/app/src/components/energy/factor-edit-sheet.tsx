import type { CheckInInput, EnergyFactorKey } from '@akeso/domain'
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { ChipRow } from '@/components/ui/chips'
import {
  ENERGY_OPTIONS,
  HYDRATION_OPTIONS,
  MEAL_OPTIONS,
  SLEEP_OPTIONS,
} from '@/state/checkin-options'
import { colors, sp, type } from '@/theme/tokens'

interface FactorEditSheetProps {
  /** Which receipt row is being edited; null keeps the sheet closed. */
  factorKey: EnergyFactorKey | null
  /** Today's check-in as submitted — the base the edit is applied to. */
  checkIn: CheckInInput
  onClose: () => void
  /** Resubmits the full check-in; the score and plan recompute from it. */
  onSave: (input: CheckInInput) => Promise<unknown>
}

const COPY: Record<EnergyFactorKey, { title: string; hint: string }> = {
  reported_energy: {
    title: 'How’s your energy right now?',
    hint: 'Your score baseline comes from this answer.',
  },
  sleep_duration: {
    title: 'How much sleep did you get?',
    hint: 'Context that helps explain today’s rhythm.',
  },
  last_meal: {
    title: 'When did you last eat?',
    hint: 'Fuel timing shapes the afternoon forecast.',
  },
  hydration: {
    title: 'How much water so far?',
    hint: 'Steady hydration supports the whole curve.',
  },
}

/**
 * "Fix one answer" bottom sheet for a receipt row: shows the same choices as
 * the check-in flow with the current answer selected. Picking a different
 * value resubmits the whole check-in, so the score, curve, and plan all
 * recompute from the corrected answer.
 */
export function FactorEditSheet({
  factorKey,
  checkIn,
  onClose,
  onSave,
}: FactorEditSheetProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (factorKey === null) return
    // Re-opening intentionally resets transient state for the new factor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaving(false)
    setError(null)
  }, [factorKey])

  if (factorKey === null) return null

  // Each edit resubmits the whole check-in, so `next` is a complete input
  // with exactly one field changed. Unchanged picks just close the sheet.
  const commit = async (next: CheckInInput, changed: boolean) => {
    if (!changed) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      onClose()
    } catch {
      setError('Couldn’t update this answer. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={saving ? undefined : onClose}
          accessibilityLabel="Close answer editing"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={type.label}>FIX AN ANSWER</Text>
          <Text style={styles.heading}>{COPY[factorKey].title}</Text>
          <Text style={styles.subheading}>
            {COPY[factorKey].hint} Changing it recalculates your score and plan.
          </Text>

          {factorKey === 'reported_energy' ? (
            <ChipRow
              options={ENERGY_OPTIONS}
              value={checkIn.reportedEnergy}
              onChange={(value) =>
                commit(
                  { ...checkIn, reportedEnergy: value },
                  value !== checkIn.reportedEnergy
                )
              }
            />
          ) : null}

          {factorKey === 'sleep_duration' ? (
            <ChipRow
              options={SLEEP_OPTIONS}
              value={checkIn.sleepDuration}
              onChange={(value) =>
                commit(
                  { ...checkIn, sleepDuration: value },
                  value !== checkIn.sleepDuration
                )
              }
            />
          ) : null}

          {factorKey === 'last_meal' ? (
            <ChipRow
              options={MEAL_OPTIONS}
              value={checkIn.lastMealTiming}
              onChange={(value) =>
                commit(
                  { ...checkIn, lastMealTiming: value },
                  value !== checkIn.lastMealTiming
                )
              }
            />
          ) : null}

          {factorKey === 'hydration' ? (
            <ChipRow
              options={HYDRATION_OPTIONS}
              value={checkIn.hydration}
              onChange={(value) =>
                commit(
                  { ...checkIn, hydration: value },
                  value !== checkIn.hydration
                )
              }
            />
          ) : null}

          {saving ? (
            <Text style={styles.saving}>Recalculating your day…</Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} disabled={saving} variant="ghost" />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(25, 28, 24, 0.48)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(5),
    paddingBottom: sp(8),
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: sp(4),
  },
  heading: { ...type.h2, marginTop: sp(1), marginBottom: sp(2) },
  subheading: { ...type.small, color: colors.textMuted, marginBottom: sp(4) },
  saving: {
    ...type.small,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: sp(3),
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: sp(3),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp(4),
  },
})
