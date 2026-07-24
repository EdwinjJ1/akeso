import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Button } from '@/components/ui/buttons'
import { colors, radius, sp, type } from '@/theme/tokens'

interface ScoreAdjustSheetProps {
  visible: boolean
  /** The score currently shown on the dashboard. */
  currentScore: number
  onClose: () => void
  onSave: (score: number, note?: string) => Promise<void>
}

const STEP = 5
const clampScore = (value: number) => Math.min(100, Math.max(0, value))

/**
 * "Feel different?" bottom sheet: lets the user correct today's score when
 * the app's number doesn't match how the day actually feels. The optional
 * note travels into the coach's context so the correction can be acted on.
 */
export function ScoreAdjustSheet({
  visible,
  currentScore,
  onClose,
  onSave,
}: ScoreAdjustSheetProps) {
  const [score, setScore] = useState(currentScore)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    // Re-opening intentionally re-seeds the draft from the live score.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScore(currentScore)
    setNote('')
    setSaving(false)
    setError(null)
  }, [visible, currentScore])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const trimmed = note.trim()
      await onSave(score, trimmed ? trimmed : undefined)
      onClose()
    } catch {
      setError('Couldn’t save your adjustment. Your changes are still here.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={saving ? undefined : onClose}
          accessibilityLabel="Close score adjustment"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={type.label}>YOUR CALL</Text>
          <Text style={styles.heading}>Feel different from {currentScore}?</Text>
          <Text style={styles.subheading}>
            You know your day best — set the number that matches how it
            actually feels, and Akeso reshapes the day around it.
          </Text>

          <View style={styles.scoreRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lower the score"
              onPress={() => setScore((value) => clampScore(value - STEP))}
              disabled={saving || score <= 0}
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepPressed,
                (saving || score <= 0) && styles.stepDisabled,
              ]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <View style={styles.scoreDisplay}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreUnit}>/ 100</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Raise the score"
              onPress={() => setScore((value) => clampScore(value + STEP))}
              disabled={saving || score >= 100}
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepPressed,
                (saving || score >= 100) && styles.stepDisabled,
              ]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>What did we miss? (optional)</Text>
          <TextInput
            accessibilityLabel="What did we miss"
            value={note}
            onChangeText={setNote}
            editable={!saving}
            maxLength={280}
            multiline
            placeholder="e.g. Barely slept, stressful morning, big workout…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} disabled={saving} variant="ghost" />
            <View style={styles.saveAction}>
              <Button
                label={error ? 'Retry' : 'Update my score'}
                onPress={submit}
                loading={saving}
                disabled={score === currentScore && !note.trim()}
                variant="cta"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(4),
    marginBottom: sp(4),
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { transform: [{ translateY: 2 }] },
  stepDisabled: { opacity: 0.35 },
  stepText: { color: colors.text, fontSize: 28, fontWeight: '900' },
  scoreDisplay: { flexDirection: 'row', alignItems: 'flex-end' },
  scoreValue: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '900',
    letterSpacing: -3,
    color: colors.text,
  },
  scoreUnit: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: sp(2) },
  label: { ...type.label, marginBottom: sp(1.5) },
  input: {
    minHeight: 72,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: sp(3),
    paddingVertical: sp(2.5),
    textAlignVertical: 'top',
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
    gap: sp(3),
    marginTop: sp(4),
  },
  saveAction: { flex: 1 },
})
