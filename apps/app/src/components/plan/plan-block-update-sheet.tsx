import {
  updatePlanBlockInputSchema,
  type PlanBlock,
  type UpdatePlanBlockInput,
} from '@akeso/domain'
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

interface PlanBlockUpdateSheetProps {
  visible: boolean
  block: PlanBlock | null
  blocks: PlanBlock[]
  onClose: () => void
  onSave: (input: UpdatePlanBlockInput) => Promise<void>
}

const overlaps = (
  input: Pick<UpdatePlanBlockInput, 'start' | 'end'>,
  block: Pick<PlanBlock, 'start' | 'end'>
) => input.start < block.end && block.start < input.end

export function PlanBlockUpdateSheet({
  visible,
  block,
  blocks,
  onClose,
  onSave,
}: PlanBlockUpdateSheetProps) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!block || !visible) return
    setTitle(block.title)
    setStart(block.start)
    setEnd(block.end)
    setCompleted(block.status === 'completed')
    setSaving(false)
    setError(null)
  }, [block, visible])

  if (!block) return null

  const submit = async () => {
    const parsed = updatePlanBlockInputSchema.safeParse({
      title,
      start,
      end,
      status: completed ? 'completed' : 'planned',
    })
    if (!parsed.success) {
      setError('Enter a title and valid times in 24-hour HH:mm format.')
      return
    }

    const conflict = blocks.find(
      (candidate) => candidate.id !== block.id && overlaps(parsed.data, candidate)
    )
    if (conflict) {
      setError(
        `This time overlaps another suggestion (${conflict.start}–${conflict.end}).`
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(parsed.data)
      onClose()
    } catch {
      setError('Couldn’t save your update. Your changes are still here.')
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
          accessibilityLabel="Close update sheet"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={type.label}>UPDATE SUGGESTION</Text>
          <Text style={styles.heading}>Make this plan yours</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            accessibilityLabel="Title"
            value={title}
            onChangeText={setTitle}
            editable={!saving}
            maxLength={120}
            style={styles.input}
          />

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Start</Text>
              <TextInput
                accessibilityLabel="Start time"
                value={start}
                onChangeText={setStart}
                editable={!saving}
                placeholder="09:00"
                maxLength={5}
                style={styles.input}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>End</Text>
              <TextInput
                accessibilityLabel="End time"
                value={end}
                onChangeText={setEnd}
                editable={!saving}
                placeholder="10:30"
                maxLength={5}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable
            onPress={() => setCompleted((value) => !value)}
            disabled={saving}
            accessibilityRole="checkbox"
            accessibilityLabel="Completed"
            accessibilityState={{ checked: completed, disabled: saving }}
            style={styles.checkRow}
          >
            <View style={[styles.checkbox, completed && styles.checkboxChecked]}>
              <Text style={styles.checkmark}>{completed ? '✓' : ''}</Text>
            </View>
            <View>
              <Text style={styles.checkTitle}>Completed</Text>
              <Text style={styles.checkHint}>Keep it in the timeline as a record.</Text>
            </View>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              label="Cancel"
              onPress={onClose}
              disabled={saving}
              variant="ghost"
            />
            <View style={styles.saveAction}>
              <Button
                label={error?.startsWith('Couldn’t save') ? 'Retry' : 'Save changes'}
                onPress={submit}
                loading={saving}
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
  heading: {
    ...type.h2,
    marginTop: sp(1),
    marginBottom: sp(4),
  },
  label: {
    ...type.label,
    marginBottom: sp(1.5),
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: sp(3),
    marginBottom: sp(3),
  },
  timeRow: {
    flexDirection: 'row',
    gap: sp(3),
  },
  timeField: { flex: 1 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: sp(3),
  },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkmark: { color: colors.text, fontSize: 18, fontWeight: '900' },
  checkTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  checkHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  error: {
    color: '#B91C1C',
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
