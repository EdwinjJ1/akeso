import { Ionicons } from '@expo/vector-icons'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type {
  FridgeCategory,
  FridgeImageUpload,
  FridgeItem,
  IngredientRecognitionResult,
} from '@akeso/domain'

import { Card } from '@/components/ui/card'
import {
  addManualCandidate,
  candidatesFromRecognition,
  editCandidate,
  removeCandidate,
  toConfirmedFridgeItems,
  toggleCandidate,
  type FridgeCandidate,
} from '@/state/fridge-flow'
import {
  resizeForRecognition,
  runRecognitionAttempt,
} from '@/state/fridge-image'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

const categories: FridgeCategory[] = [
  'protein',
  'vegetable',
  'fruit',
  'dairy',
  'grain',
  'other',
]

const nextCategory = (current: FridgeCategory): FridgeCategory =>
  categories[(categories.indexOf(current) + 1) % categories.length]

export function FridgeRecognition() {
  const {
    fridge,
    recognizeFridgeImage,
    saveFridgeItems,
    updateFridgeItem,
    deleteFridgeItem,
  } = useAppState()
  const [candidates, setCandidates] = useState<FridgeCandidate[]>([])
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] =
    useState<FridgeCategory>('vegetable')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [retryImage, setRetryImage] = useState<FridgeImageUpload | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const applyRecognitionResult = (result: IngredientRecognitionResult) => {
    setCandidates(candidatesFromRecognition(result))
    if (result.status === 'empty') {
      setMessage(
        result.reason === 'unrecognizable_image'
          ? 'This photo is too unclear. Try another photo or add ingredients manually.'
          : 'No food was detected. You can still add ingredients manually.'
      )
    } else if (result.status === 'refused') {
      setMessage('This image could not be processed. Manual entry is still available.')
    } else {
      setMessage('Review every candidate — nothing is saved until you confirm it.')
    }
  }

  const recognizeProcessedImage = async (image: FridgeImageUpload) => {
    const attempt = await runRecognitionAttempt(image, recognizeFridgeImage)
    if (!attempt.ok) {
      setRetryImage(attempt.image)
      setMessage(attempt.error)
      return
    }
    setRetryImage(null)
    applyRecognitionResult(attempt.result)
  }

  const recognizeAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setWorking(true)
    setMessage(null)
    setRetryImage(null)
    try {
      const resize = resizeForRecognition(asset.width, asset.height)
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize ? [{ resize }] : [],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      )
      setPreviewUri(processed.uri)
      await recognizeProcessedImage({
        uri: processed.uri,
        filename: `fridge-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Recognition failed.')
    } finally {
      setWorking(false)
    }
  }

  const retryRecognition = async () => {
    if (!retryImage) return
    setWorking(true)
    setMessage(null)
    try {
      await recognizeProcessedImage(retryImage)
    } finally {
      setWorking(false)
    }
  }

  const openCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setMessage('Camera permission was denied. Use the photo library or manual entry.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      })
      if (!result.canceled) await recognizeAsset(result.assets[0])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the camera.')
    }
  }

  const openLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      })
      if (!result.canceled) await recognizeAsset(result.assets[0])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open photos.')
    }
  }

  const saveConfirmed = async () => {
    const items = toConfirmedFridgeItems(candidates)
    if (items.length === 0) {
      setMessage('Select at least one candidate before saving.')
      return
    }
    setWorking(true)
    try {
      await saveFridgeItems(items)
      setCandidates([])
      setPreviewUri(null)
      setMessage('Saved. Today’s nutrition advice now uses this confirmed inventory.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed. Your edits remain.')
    } finally {
      setWorking(false)
    }
  }

  const addManual = () => {
    const next = addManualCandidate(candidates, {
      name: manualName,
      category: manualCategory,
    })
    if (next !== candidates) {
      setCandidates(next)
      setManualName('')
      setMessage('Manual ingredient added and selected. Review it before saving.')
    }
  }

  return (
    <>
      <Card tone="green">
        <Text style={type.h2}>Scan your fridge</Text>
        <Text style={styles.intro}>
          Take or upload a photo. AI suggests what is present; you stay in control of every saved item.
        </Text>
        <View style={styles.actionRow}>
          <ActionButton icon="camera" label="Camera" onPress={openCamera} flex={2} />
          <ActionButton icon="images" label="Upload photo" onPress={openLibrary} flex={3} />
        </View>
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}
        {working ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.progressText}>Working with the image…</Text>
          </View>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {retryImage && !working ? (
          <Pressable
            style={styles.retryButton}
            onPress={retryRecognition}
            accessibilityRole="button"
            accessibilityLabel="Retry image recognition"
          >
            <Ionicons name="refresh" size={19} color={colors.text} />
            <Text style={styles.actionLabel}>Retry recognition</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <Text style={type.h3}>Review candidates</Text>
        <Text style={styles.hint}>AI results start unselected. Tap the circle to confirm.</Text>
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.localId}
            candidate={candidate}
            onToggle={() =>
              setCandidates((items) => toggleCandidate(items, candidate.localId))
            }
            onChange={(patch) =>
              setCandidates((items) => editCandidate(items, candidate.localId, patch))
            }
            onRemove={() =>
              setCandidates((items) => removeCandidate(items, candidate.localId))
            }
          />
        ))}
        {candidates.length === 0 ? (
          <Text style={styles.empty}>No pending candidates. Take a photo or add one below.</Text>
        ) : null}

        <View style={styles.manualRow}>
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder="Add a missed ingredient"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.manualInput]}
          />
          <Pressable
            style={styles.categoryButton}
            onPress={() => setManualCategory(nextCategory(manualCategory))}
            accessibilityRole="button"
            accessibilityLabel="Change manual ingredient category"
          >
            <Text style={styles.categoryText}>{manualCategory}</Text>
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={addManual}
            accessibilityRole="button"
            accessibilityLabel="Add manual ingredient"
          >
            <Ionicons name="add" size={20} color={colors.textOnColor} />
          </Pressable>
        </View>
        <Pressable
          style={[styles.saveButton, working && styles.disabled]}
          onPress={saveConfirmed}
          disabled={working}
          accessibilityRole="button"
          accessibilityLabel="Save confirmed ingredients"
        >
          <Text style={styles.saveText}>
            Save {candidates.filter((item) => item.confirmed).length} confirmed
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={type.h3}>Confirmed inventory</Text>
        <Text style={styles.hint}>Presence only — no grams or quantities.</Text>
        {fridge.map((item) => (
          <InventoryRow
            key={item.id}
            item={item}
            onSave={async (nextItem) => {
              try {
                await updateFridgeItem(nextItem)
                setMessage('Inventory item updated and advice refreshed.')
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : 'Update failed. Your edit remains.'
                )
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteFridgeItem(id)
                setMessage('Inventory item removed and advice refreshed.')
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Delete failed.')
              }
            }}
          />
        ))}
        {fridge.length === 0 ? (
          <Text style={styles.empty}>Your confirmed fridge is empty.</Text>
        ) : null}
      </Card>
    </>
  )
}

function ActionButton({
  icon,
  label,
  onPress,
  flex,
}: {
  icon: 'camera' | 'images'
  label: string
  onPress: () => void
  flex: number
}) {
  return (
    <Pressable
      style={[styles.actionButton, { flex }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={21} color={colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  )
}

function CandidateRow({
  candidate,
  onToggle,
  onChange,
  onRemove,
}: {
  candidate: FridgeCandidate
  onToggle: () => void
  onChange: (patch: Pick<FridgeCandidate, 'name' | 'category'>) => void
  onRemove: () => void
}) {
  const lowConfidence = candidate.confidence !== null && candidate.confidence < 0.7
  return (
    <View style={[styles.itemRow, lowConfidence && styles.lowConfidence]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityLabel={`Confirm ${candidate.name}`}
        accessibilityState={{ checked: candidate.confirmed }}
      >
        <Ionicons
          name={candidate.confirmed ? 'checkmark-circle' : 'ellipse-outline'}
          size={27}
          color={candidate.confirmed ? colors.primaryDark : colors.textMuted}
        />
      </Pressable>
      <View style={styles.itemBody}>
        <TextInput
          value={candidate.name}
          onChangeText={(name) => onChange({ name, category: candidate.category })}
          style={styles.input}
        />
        <Pressable
          onPress={() =>
            onChange({ name: candidate.name, category: nextCategory(candidate.category) })
          }
        >
          <Text style={styles.meta}>
            {candidate.category} · tap to change
            {candidate.confidence === null
              ? ' · manual'
              : ` · ${Math.round(candidate.confidence * 100)}% confidence`}
          </Text>
        </Pressable>
        {lowConfidence ? (
          <Text style={styles.warning}>Low confidence — check or edit this item.</Text>
        ) : null}
      </View>
      <Pressable onPress={onRemove} accessibilityLabel={`Remove ${candidate.name}`}>
        <Ionicons name="trash-outline" size={21} color={colors.danger} />
      </Pressable>
    </View>
  )
}

function InventoryRow({
  item,
  onSave,
  onDelete,
}: {
  item: FridgeItem
  onSave: (item: FridgeItem) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(item)
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemBody}>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
          style={styles.input}
        />
        <Pressable
          onPress={() =>
            setDraft((current) => ({
              ...current,
              category: nextCategory(current.category),
            }))
          }
        >
          <Text style={styles.meta}>{draft.category} · tap to change</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => onSave({ ...draft, name: draft.name.trim() })}>
        <Ionicons name="save-outline" size={22} color={colors.primaryDark} />
      </Pressable>
      <Pressable onPress={() => onDelete(item.id)}>
        <Ionicons name="trash-outline" size={22} color={colors.danger} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: { ...type.body, marginTop: sp(2), color: colors.text },
  actionRow: { flexDirection: 'row', gap: sp(2), marginTop: sp(4) },
  actionButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(2),
  },
  actionLabel: { fontWeight: '800', color: colors.text },
  preview: { width: '100%', height: 210, borderRadius: radius.md, marginTop: sp(4) },
  progress: { flexDirection: 'row', gap: sp(2), alignItems: 'center', marginTop: sp(3) },
  progressText: { fontWeight: '700', color: colors.text },
  message: { ...type.small, color: colors.text, marginTop: sp(3) },
  retryButton: {
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(2),
    marginTop: sp(3),
  },
  hint: { ...type.small, marginTop: sp(1) },
  empty: { ...type.small, marginVertical: sp(4) },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    paddingVertical: sp(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lowConfidence: { backgroundColor: '#FFF2D7', paddingHorizontal: sp(2) },
  itemBody: { flex: 1 },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: sp(3),
    fontSize: 15,
  },
  meta: { ...type.small, color: colors.primaryDark, marginTop: sp(1) },
  warning: { ...type.small, color: colors.warning, fontWeight: '700' },
  manualRow: { flexDirection: 'row', gap: sp(2), marginTop: sp(4), alignItems: 'center' },
  manualInput: { flex: 1 },
  categoryButton: { paddingVertical: sp(2), paddingHorizontal: sp(2) },
  categoryText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  addButton: { backgroundColor: colors.text, borderRadius: radius.pill, padding: sp(2.5) },
  saveButton: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sp(4),
  },
  disabled: { opacity: 0.55 },
  saveText: { color: colors.textOnColor, fontWeight: '900' },
})
