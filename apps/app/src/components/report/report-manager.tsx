import { Ionicons } from '@expo/vector-icons'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useState } from 'react'
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
  HealthRecommendationSet,
  HealthReport,
  ReportExtractionResult,
  ReportImageUpload,
  ReportMetric,
  ReportMetricStatus,
} from '@akeso/domain'

import { Card } from '@/components/ui/card'
import {
  addManualMetricCandidate,
  candidateStatus,
  candidatesFromExtraction,
  editMetricCandidate,
  hasInvalidConfirmedCandidates,
  parseRequiredMetricNumber,
  removeMetricCandidate,
  toConfirmedReportMetrics,
  toggleMetricCandidate,
  type ReportMetricCandidate,
} from '@/state/report-flow'
import { resizeForRecognition } from '@/state/fridge-image'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

const statusColors: Record<ReportMetricStatus, string> = {
  low: colors.warning,
  high: colors.danger,
  normal: colors.primaryDark,
  unknown: colors.textMuted,
}

const statusLabel: Record<ReportMetricStatus, string> = {
  low: 'Below report range',
  high: 'Above report range',
  normal: 'Within report range',
  unknown: 'No range on report',
}

const toNullableNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function ReportManager() {
  const {
    extractReportMetrics,
    getReports,
    saveReport,
    deleteReport,
    getReportRecommendations,
    regenerateReportRecommendations,
  } = useAppState()

  const [reports, setReports] = useState<HealthReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<ReportMetricCandidate[]>([])
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [retryImage, setRetryImage] = useState<ReportImageUpload | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refreshReports = useCallback(async () => {
    setLoadingReports(true)
    setListError(null)
    try {
      setReports(await getReports())
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : 'Could not load your reports.'
      )
    } finally {
      setLoadingReports(false)
    }
  }, [getReports])

  useEffect(() => {
    void refreshReports()
  }, [refreshReports])

  const applyExtractionResult = (result: ReportExtractionResult) => {
    setCandidates(candidatesFromExtraction(result))
    if (result.status === 'empty') {
      setMessage(
        result.reason === 'unrecognizable_image'
          ? 'This photo is too unclear to read. Try another photo or add metrics manually.'
          : 'No test metrics were detected. You can still add them manually.'
      )
    } else if (result.status === 'refused') {
      setMessage('This image could not be processed. Manual entry is still available.')
    } else {
      setMessage(
        'Review every metric — nothing is saved until you confirm it. Correct any misread value or range.'
      )
    }
  }

  const extractProcessedImage = async (image: ReportImageUpload) => {
    try {
      const result = await extractReportMetrics(image)
      setRetryImage(null)
      applyExtractionResult(result)
    } catch (error) {
      setRetryImage(image)
      setMessage(
        error instanceof Error ? error.message : 'Extraction failed. You can retry.'
      )
    }
  }

  const extractAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setWorking(true)
    setMessage(null)
    setRetryImage(null)
    try {
      const resize = resizeForRecognition(asset.width, asset.height)
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize ? [{ resize }] : [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )
      setPreviewUri(processed.uri)
      await extractProcessedImage({
        uri: processed.uri,
        filename: `report-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not process the image.')
    } finally {
      setWorking(false)
    }
  }

  const retryExtraction = async () => {
    if (!retryImage) return
    setWorking(true)
    setMessage(null)
    try {
      await extractProcessedImage(retryImage)
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
      if (!result.canceled) await extractAsset(result.assets[0])
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
      if (!result.canceled) await extractAsset(result.assets[0])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open photos.')
    }
  }

  const addManual = () => {
    const next = addManualMetricCandidate(candidates, {
      name: 'New metric',
      value: 0,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
    })
    setCandidates(next)
    setMessage('Manual metric added — edit its name, value and range, then confirm.')
  }

  const saveConfirmed = async () => {
    if (hasInvalidConfirmedCandidates(candidates)) {
      setMessage('Every confirmed metric needs a name and a valid numeric value.')
      return
    }
    const metrics = toConfirmedReportMetrics(candidates)
    if (metrics.length === 0) {
      setMessage('Confirm at least one metric with a valid value before saving.')
      return
    }
    setWorking(true)
    try {
      await saveReport(metrics)
      setCandidates([])
      setPreviewUri(null)
      setMessage('Report saved. Your recommendations are ready below.')
      await refreshReports()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed. Your edits remain.')
    } finally {
      setWorking(false)
    }
  }

  const confirmedCount = candidates.filter((candidate) => candidate.confirmed).length

  return (
    <>
      <Card tone="blue">
        <Text style={type.h2}>Upload a health report</Text>
        <Text style={styles.intro}>
          Take or upload a photo of a lab or blood-test report (JPG or PNG). Akeso reads the
          values; you confirm every one before anything is saved.
        </Text>
        <View style={styles.actionRow}>
          <ActionButton icon="camera" label="Camera" onPress={openCamera} />
          <ActionButton icon="images" label="Upload photo" onPress={openLibrary} />
        </View>
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}
        {working ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.progressText}>Reading the report…</Text>
          </View>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {retryImage && !working ? (
          <Pressable
            style={styles.retryButton}
            onPress={retryExtraction}
            accessibilityRole="button"
            accessibilityLabel="Retry report extraction"
          >
            <Ionicons name="refresh" size={19} color={colors.text} />
            <Text style={styles.actionLabel}>Retry extraction</Text>
          </Pressable>
        ) : null}
      </Card>

      {candidates.length > 0 || confirmedCount > 0 ? (
        <Card>
          <Text style={type.h3}>Review metrics</Text>
          <Text style={styles.hint}>
            Extracted values start unconfirmed. Reference ranges come from the report only —
            leave them blank if the report shows none.
          </Text>
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.localId}
              candidate={candidate}
              onToggle={() =>
                setCandidates((items) => toggleMetricCandidate(items, candidate.localId))
              }
              onChange={(patch) =>
                setCandidates((items) =>
                  editMetricCandidate(items, candidate.localId, patch)
                )
              }
              onRemove={() =>
                setCandidates((items) => removeMetricCandidate(items, candidate.localId))
              }
            />
          ))}
          <Pressable
            style={styles.manualAdd}
            onPress={addManual}
            accessibilityRole="button"
            accessibilityLabel="Add a metric manually"
          >
            <Ionicons name="add" size={18} color={colors.primaryDark} />
            <Text style={styles.manualAddText}>Add a metric manually</Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, working && styles.disabled]}
            onPress={saveConfirmed}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel="Save confirmed metrics as a report"
          >
            <Text style={styles.saveText}>Save {confirmedCount} confirmed</Text>
          </Pressable>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Your reports</Text>
      {loadingReports ? (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.progressText}>Loading reports…</Text>
        </View>
      ) : null}
      {listError ? (
        <Card tone="muted">
          <Text style={styles.errorText}>{listError}</Text>
          <Pressable onPress={refreshReports} accessibilityRole="button">
            <Text style={styles.manualAddText}>Retry</Text>
          </Pressable>
        </Card>
      ) : null}
      {!loadingReports && !listError && reports.length === 0 ? (
        <Card tone="muted">
          <Text style={styles.empty}>
            No reports yet. Upload one above to get safe, non-diagnostic suggestions.
          </Text>
        </Card>
      ) : null}
      {reports.map((report) => (
        <SavedReportCard
          key={report.id}
          report={report}
          getRecommendations={getReportRecommendations}
          regenerate={regenerateReportRecommendations}
          onDeleted={async () => {
            try {
              await deleteReport(report.id)
              await refreshReports()
            } catch (error) {
              setListError(
                error instanceof Error ? error.message : 'Delete failed.'
              )
            }
          }}
        />
      ))}
    </>
  )
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: 'camera' | 'images'
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.actionButton}
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
  candidate: ReportMetricCandidate
  onToggle: () => void
  onChange: (patch: {
    name: string
    value: number
    unit: string
    referenceLow: number | null
    referenceHigh: number | null
  }) => void
  onRemove: () => void
}) {
  const [name, setName] = useState(candidate.name)
  const [value, setValue] = useState(String(candidate.value))
  const [unit, setUnit] = useState(candidate.unit)
  const [low, setLow] = useState(
    candidate.referenceLow === null ? '' : String(candidate.referenceLow)
  )
  const [high, setHigh] = useState(
    candidate.referenceHigh === null ? '' : String(candidate.referenceHigh)
  )

  const commit = (patch: {
    name?: string
    value?: string
    unit?: string
    low?: string
    high?: string
  }) => {
    const nextValue = patch.value ?? value
    onChange({
      name: patch.name ?? name,
      value: parseRequiredMetricNumber(nextValue),
      unit: patch.unit ?? unit,
      referenceLow: toNullableNumber(patch.low ?? low),
      referenceHigh: toNullableNumber(patch.high ?? high),
    })
  }

  const status = candidateStatus(candidate)
  const lowConfidence = candidate.confidence !== null && candidate.confidence < 0.7

  return (
    <View style={[styles.candidate, lowConfidence && styles.lowConfidence]}>
      <View style={styles.candidateHeader}>
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
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text)
            commit({ name: text })
          }}
          placeholder="Metric name"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.nameInput]}
        />
        <Pressable onPress={onRemove} accessibilityLabel={`Remove ${candidate.name}`}>
          <Ionicons name="trash-outline" size={21} color={colors.danger} />
        </Pressable>
      </View>
      <View style={styles.fieldRow}>
        <LabeledInput
          label="Value"
          value={value}
          onChangeText={(text) => {
            setValue(text)
            commit({ value: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Unit"
          value={unit}
          onChangeText={(text) => {
            setUnit(text)
            commit({ unit: text })
          }}
        />
      </View>
      <View style={styles.fieldRow}>
        <LabeledInput
          label="Ref. low"
          value={low}
          onChangeText={(text) => {
            setLow(text)
            commit({ low: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Ref. high"
          value={high}
          onChangeText={(text) => {
            setHigh(text)
            commit({ high: text })
          }}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
        <Text style={[styles.statusText, { color: statusColors[status] }]}>
          {statusLabel[status]}
        </Text>
        {candidate.confidence !== null ? (
          <Text style={styles.confidence}>
            {Math.round(candidate.confidence * 100)}% read confidence
          </Text>
        ) : null}
      </View>
      {candidate.uncertaintyReason ? (
        <Text style={styles.warning}>Check this one: {candidate.uncertaintyReason}</Text>
      ) : null}
    </View>
  )
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  keyboardType?: 'numeric' | 'default'
}) {
  return (
    <View style={styles.labeledInput}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        style={styles.input}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  )
}

function SavedReportCard({
  report,
  getRecommendations,
  regenerate,
  onDeleted,
}: {
  report: HealthReport
  getRecommendations: (id: string) => Promise<HealthRecommendationSet>
  regenerate: (id: string) => Promise<HealthRecommendationSet>
  onDeleted: () => void
}) {
  const [recommendations, setRecommendations] =
    useState<HealthRecommendationSet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setBusy(true)
    setError(null)
    try {
      setRecommendations(await getRecommendations(report.id))
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load recommendations.'
      )
    } finally {
      setBusy(false)
    }
  }

  const runRegenerate = async () => {
    setBusy(true)
    setError(null)
    try {
      setRecommendations(await regenerate(report.id))
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not regenerate recommendations.'
      )
    } finally {
      setBusy(false)
    }
  }

  const created = report.createdAt.slice(0, 10)

  return (
    <Card>
      <View style={styles.reportHeader}>
        <Text style={type.h3}>Report · {created}</Text>
        <Pressable onPress={onDeleted} accessibilityLabel="Delete report">
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>
      {report.metrics.map((metric) => (
        <MetricRow key={metric.id} metric={metric} />
      ))}

      {recommendations ? (
        <View style={styles.recBlock}>
          {recommendations.recommendations.map((rec) => (
            <View key={rec.id} style={styles.rec}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recDetail}>{rec.detail}</Text>
            </View>
          ))}
          <Card tone="muted" style={styles.disclaimerCard}>
            <Ionicons name="medkit-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.disclaimerText}>{recommendations.disclaimer}</Text>
          </Card>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.recActions}>
        <Pressable
          style={[styles.recButton, busy && styles.disabled]}
          onPress={load}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.recButtonText}>
            {busy ? 'Working…' : recommendations ? 'Refresh advice' : 'View recommendations'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.recButtonDark, busy && styles.disabled]}
          onPress={runRegenerate}
          disabled={busy}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={15} color={colors.textOnColor} />
          <Text style={styles.recButtonDarkText}>Generate with AI</Text>
        </Pressable>
      </View>
    </Card>
  )
}

function MetricRow({ metric }: { metric: ReportMetric }) {
  const range =
    metric.referenceLow !== null && metric.referenceHigh !== null
      ? `${metric.referenceLow}–${metric.referenceHigh}`
      : metric.referenceLow !== null
        ? `≥ ${metric.referenceLow}`
        : metric.referenceHigh !== null
          ? `≤ ${metric.referenceHigh}`
          : 'no range'
  return (
    <View style={styles.metricRow}>
      <View style={[styles.statusDot, { backgroundColor: statusColors[metric.status] }]} />
      <View style={styles.metricBody}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricMeta}>
          {metric.value}
          {metric.unit ? ` ${metric.unit}` : ''} · ref {range} · {statusLabel[metric.status]}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: { ...type.body, marginTop: sp(2), color: colors.text },
  actionRow: { flexDirection: 'row', gap: sp(2), marginTop: sp(4) },
  actionButton: {
    flex: 1,
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
  hint: { ...type.small, marginTop: sp(1), marginBottom: sp(2) },
  candidate: {
    paddingVertical: sp(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lowConfidence: { backgroundColor: '#FFF2D7', paddingHorizontal: sp(2), borderRadius: radius.sm },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: sp(2) },
  fieldRow: { flexDirection: 'row', gap: sp(2), marginTop: sp(2) },
  labeledInput: { flex: 1 },
  fieldLabel: { ...type.small, marginBottom: sp(1) },
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
  nameInput: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: sp(2), marginTop: sp(2) },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { ...type.small, fontWeight: '800' },
  confidence: { ...type.small, color: colors.textMuted, marginLeft: 'auto' },
  warning: { ...type.small, color: colors.warning, fontWeight: '700', marginTop: sp(1) },
  manualAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    marginTop: sp(3),
  },
  manualAddText: { fontWeight: '800', color: colors.primaryDark },
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
  sectionTitle: { ...type.h2, marginTop: sp(4), marginBottom: sp(3) },
  empty: { ...type.small },
  errorText: { ...type.small, color: colors.danger, marginTop: sp(2) },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(2),
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    paddingVertical: sp(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricBody: { flex: 1 },
  metricName: { fontSize: 15, fontWeight: '700', color: colors.text },
  metricMeta: { ...type.small, marginTop: 1 },
  recBlock: { marginTop: sp(3) },
  rec: { marginBottom: sp(3) },
  recTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  recDetail: { ...type.small, color: colors.textSecondary, marginTop: sp(1), lineHeight: 19 },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    padding: sp(3),
  },
  disclaimerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, flex: 1 },
  recActions: { flexDirection: 'row', gap: sp(2), marginTop: sp(3) },
  recButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recButtonText: { fontWeight: '800', color: colors.text },
  recButtonDark: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1),
  },
  recButtonDarkText: { color: colors.textOnColor, fontWeight: '900' },
})
