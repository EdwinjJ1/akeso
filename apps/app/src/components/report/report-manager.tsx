import type {
  HealthReport,
  ReportExtractionResult,
  ReportImageUpload,
  ReportMetric,
  ReportMetricStatus,
} from '@akeso/domain'
import { createReportRequestSchema } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Card } from '@/components/ui/card'
import { useAppState } from '@/state/app-state'
import { resizeForRecognition } from '@/state/fridge-image'
import {
  addBlankManualMetricCandidate,
  candidateStatus,
  candidatesFromExtraction,
  editMetricCandidate,
  hasInvalidConfirmedCandidates,
  hasDuplicateReportCandidates,
  hasInvalidReportCandidates,
  parseRequiredMetricNumber,
  removeMetricCandidate,
  toReviewedReportMetrics,
  toggleMetricCandidate,
  type ReportMetricCandidate,
} from '@/state/report-flow'
import { colors, radius, sp, type } from '@/theme/tokens'
import { todayISO } from '@/utils/dates'

import {
  demoReportExtraction,
  reportFixtureScenarios,
  type ReportFixtureScenario,
} from './report-demo'

type ReportSource = 'camera' | 'photo' | 'pdf'

interface SelectedFile {
  name: string
  source: ReportSource
  sizeLabel: string
  detail: string
}

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

const statusIcon: Record<
  ReportMetricStatus,
  'arrow-down-circle' | 'arrow-up-circle' | 'checkmark-circle' | 'help-circle'
> = {
  low: 'arrow-down-circle',
  high: 'arrow-up-circle',
  normal: 'checkmark-circle',
  unknown: 'help-circle',
}

const sourceIcon: Record<ReportSource, 'camera' | 'images' | 'document-text'> = {
  camera: 'camera',
  photo: 'images',
  pdf: 'document-text',
}

const toNullableNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : Number.NaN
}

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return 'Size unavailable'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const reportFixtureMode = !process.env.EXPO_PUBLIC_API_URL

export function ReportManager() {
  const router = useRouter()
  const {
    extractReportMetrics,
    getReports,
    saveReport,
  } = useAppState()

  const [reports, setReports] = useState<HealthReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<ReportMetricCandidate[]>([])
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [retryImage, setRetryImage] = useState<ReportImageUpload | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reportName, setReportName] = useState('Blood test report')
  const [reportDate, setReportDate] = useState(todayISO())
  const [savedNotice, setSavedNotice] = useState(false)
  const [candidateSession, setCandidateSession] = useState(0)
  const extractionBusy = useRef(false)

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

  useFocusEffect(
    useCallback(() => {
      void refreshReports()
    }, [refreshReports])
  )

  const applyExtractionResult = (result: ReportExtractionResult) => {
    setCandidateSession((session) => session + 1)
    setCandidates(candidatesFromExtraction(result))
    setSavedNotice(false)
    if (result.status === 'empty') {
      setMessage(
        result.reason === 'unrecognizable_image'
          ? 'This file is too unclear to read. Try another file or add metrics manually.'
          : 'No test metrics were detected. You can still add them manually.'
      )
    } else if (result.status === 'refused') {
      setMessage(
        'This file could not be processed. Manual entry is still available.'
      )
    } else {
      setMessage(
        'Review every field. Nothing is saved or used for advice until you confirm it.'
      )
    }
  }

  const beginExtraction = () => {
    if (extractionBusy.current || working) return false
    extractionBusy.current = true
    setWorking(true)
    return true
  }

  const endExtraction = () => {
    extractionBusy.current = false
    setWorking(false)
  }

  const extractProcessedImage = async (image: ReportImageUpload) => {
    try {
      const result = await extractReportMetrics(image)
      setRetryImage(null)
      applyExtractionResult(result)
    } catch (error) {
      setRetryImage(image)
      setMessage(
        error instanceof Error
          ? error.message
          : 'Extraction failed. Your file is still here, so you can retry.'
      )
    }
  }

  const extractAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'photo'
  ) => {
    setMessage(null)
    setRetryImage(null)
    setSavedNotice(false)
    setCandidates([])
    setSelectedFile({
      name: asset.fileName ?? 'health-report.jpg',
      source,
      sizeLabel: formatBytes(asset.fileSize),
      detail: 'JPG image · 1 page',
    })
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
        filename: 'report.jpg',
        mimeType: 'image/jpeg',
      })
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not process the image.'
      )
    }
  }

  const retryExtraction = async () => {
    if (!retryImage || !beginExtraction()) return
    setMessage(null)
    try {
      await extractProcessedImage(retryImage)
    } finally {
      endExtraction()
    }
  }

  const openCamera = async () => {
    if (!beginExtraction()) return
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setMessage(
          'Camera permission was denied. Use photos, PDF, or manual entry instead.'
        )
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      })
      if (!result.canceled) await extractAsset(result.assets[0], 'camera')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not open the camera.'
      )
    } finally {
      endExtraction()
    }
  }

  const openLibrary = async () => {
    if (!beginExtraction()) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      })
      if (!result.canceled) await extractAsset(result.assets[0], 'photo')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not open photos.'
      )
    } finally {
      endExtraction()
    }
  }

  const openPdf = async () => {
    if (!beginExtraction()) return
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      setSelectedFile({
        name: asset.name,
        source: 'pdf',
        sizeLabel: formatBytes(asset.size),
        detail: 'PDF document · page count pending',
      })
      setPreviewUri(null)
      setRetryImage(null)
      setSavedNotice(false)
      setCandidates([])
      setMessage('PDF selected. Showing the local UI preview for this MVP.')
      await wait(700)
      applyExtractionResult(demoReportExtraction)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not open the PDF picker.'
      )
    } finally {
      endExtraction()
    }
  }

  const showDemo = async (scenario: ReportFixtureScenario) => {
    if (!beginExtraction()) return
    setSelectedFile({
      name: scenario.filename,
      source: 'pdf',
      sizeLabel: scenario.sizeLabel,
      detail: scenario.pageLabel,
    })
    setReportName(scenario.reportName)
    setReportDate(scenario.reportDate)
    setPreviewUri(null)
    setRetryImage(null)
    setSavedNotice(false)
    setCandidates([])
    setMessage(null)
    try {
      await wait(300)
      await extractProcessedImage({
        uri: `fixture-report://${scenario.id}`,
        filename: scenario.filename,
        mimeType: 'image/jpeg',
      })
    } finally {
      endExtraction()
    }
  }

  const addManual = () => {
    setCandidates(addBlankManualMetricCandidate)
    setMessage(
      'Manual metric added. Edit every field, then confirm it before saving.'
    )
  }

  const confirmAll = () => {
    setCandidates((items) =>
      items.map((candidate) => ({ ...candidate, confirmed: true }))
    )
  }

  const saveConfirmed = async () => {
    if (
      hasInvalidConfirmedCandidates(candidates) ||
      hasInvalidReportCandidates(candidates)
    ) {
      setMessage(
        'Every metric needs a name, numeric result, valid reference bounds, and a low bound no greater than its high bound.'
      )
      return
    }
    if (hasDuplicateReportCandidates(candidates)) {
      setMessage('Metric names must be unique. Rename or remove duplicates.')
      return
    }
    const metrics = toReviewedReportMetrics(candidates)
    if (!metrics.some((metric) => metric.confirmed)) {
      setMessage('Confirm at least one valid metric before saving this report.')
      return
    }
    const request = createReportRequestSchema.safeParse({
      name: reportName.trim(),
      reportDate: reportDate.trim() || null,
      metrics,
    })
    if (!request.success) {
      setMessage('Check the report name, date, metric fields and reference ranges.')
      return
    }
    setWorking(true)
    try {
      await saveReport(request.data)
      setCandidates([])
      setPreviewUri(null)
      setSelectedFile(null)
      setReportName('Blood test report')
      setReportDate(todayISO())
      setSavedNotice(true)
      setMessage(null)
      await refreshReports()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Save failed. Your edits are still here.'
      )
    } finally {
      setWorking(false)
    }
  }

  const confirmedCount = candidates.filter(
    (candidate) => candidate.confirmed
  ).length
  const lowConfidenceCount = candidates.filter(
    (candidate) => candidate.confidence !== null && candidate.confidence < 0.7
  ).length
  const workflowStep = savedNotice
    ? 4
    : candidates.length > 0
      ? 3
      : working
        ? 2
        : selectedFile
          ? 1
          : 0

  const totalAbnormal = useMemo(
    () =>
      reports.reduce(
        (total, report) =>
          total +
          report.metrics.filter(
            (metric) =>
              metric.confirmed &&
              (metric.status === 'high' || metric.status === 'low')
          ).length,
        0
      ),
    [reports]
  )

  return (
    <>
      <WorkflowSteps current={workflowStep} />

      {savedNotice ? (
        <Card tone="green" style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={26} color={colors.text} />
          <View style={styles.flexBody}>
            <Text style={type.h3}>Report saved</Text>
            <Text style={styles.smallText}>
              All reviewed fields were saved. Advice uses only the metrics you
              confirmed and is now available in report history.
            </Text>
          </View>
        </Card>
      ) : null}

      <Card tone="blue">
        <View style={styles.cardHeadingRow}>
          <View style={styles.flexBody}>
            <Text style={type.h2}>Add a health report</Text>
            <Text style={styles.intro}>
              Choose a clear lab or pathology report. You stay in control: Akeso
              will not use a value until you confirm it.
            </Text>
          </View>
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={13} color={colors.primaryDark} />
            <Text style={styles.privateText}>Private</Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton
            icon="camera"
            label="Camera"
            detail="Take a photo"
            onPress={openCamera}
            disabled={working}
          />
          <ActionButton
            icon="images"
            label="Photos"
            detail="JPG or PNG"
            onPress={openLibrary}
            disabled={working}
          />
          <ActionButton
            icon="document-text"
            label="Files"
            detail="PDF preview"
            onPress={openPdf}
            disabled={working}
          />
        </View>

        {reportFixtureMode ? (
          <View style={styles.fixturePanel}>
            <View style={styles.fixtureHeadingRow}>
              <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
              <View style={styles.flexBody}>
                <Text style={styles.fixtureTitle}>Deterministic demo fixtures</Text>
                <Text style={styles.fixtureSubtitle}>
                  Runs locally without an AI key. Choose a safety or review case.
                </Text>
              </View>
            </View>
            <View style={styles.fixtureGrid} testID="report-fixture-grid">
              {reportFixtureScenarios.map((scenario) => (
                <Pressable
                  key={scenario.id}
                  onPress={() => void showDemo(scenario)}
                  disabled={working}
                  accessibilityRole="button"
                  accessibilityLabel={`Load ${scenario.title} report fixture`}
                  style={({ pressed }) => [
                    styles.fixtureButton,
                    pressed && styles.pressed,
                    working && styles.disabled,
                  ]}
                >
                  <Text style={styles.fixtureButtonTitle}>{scenario.title}</Text>
                  <Text style={styles.fixtureButtonSummary}>
                    {scenario.summary}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.fileRules}>
          JPG, PNG or PDF · up to 10 MB · printed laboratory reports work best
        </Text>

        {selectedFile ? (
          <SelectedFileCard file={selectedFile} previewUri={previewUri} />
        ) : null}

        {working ? (
          <ParsingProgress fileName={selectedFile?.name ?? 'your report'} />
        ) : null}

        {message ? (
          <View style={styles.messageBox} accessibilityLiveRegion="polite">
            <Ionicons
              name={retryImage ? 'alert-circle' : 'information-circle'}
              size={18}
              color={retryImage ? colors.danger : colors.primaryDark}
            />
            <Text style={styles.message}>{message}</Text>
          </View>
        ) : null}

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

      {candidates.length > 0 ? (
        <Card>
          <View style={styles.reviewHeading}>
            <View style={styles.flexBody}>
              <Text style={type.h2}>Review the extracted details</Text>
              <Text style={styles.hint}>
                Check the report information and every metric against the original
                file. Unconfirmed values stay visible for later correction but are
                never used for advice.
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {confirmedCount}/{candidates.length} confirmed
              </Text>
            </View>
          </View>

          <View style={styles.reportDetailsPanel}>
            <Text style={styles.panelLabel}>Report details</Text>
            <View style={styles.fieldRow}>
              <LabeledInput
                label="Report name"
                value={reportName}
                onChangeText={setReportName}
                accessibilityLabel="Report name"
              />
              <LabeledInput
                label="Report date"
                value={reportDate}
                onChangeText={setReportDate}
                accessibilityLabel="Report date"
              />
            </View>
            <Text style={styles.futureNote}>
              These details are saved with the report and can be corrected later.
            </Text>
          </View>

          {lowConfidenceCount > 0 ? (
            <View style={styles.reviewAlert}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.reviewAlertText}>
                {lowConfidenceCount} field{lowConfidenceCount === 1 ? '' : 's'}
                {' '}need extra attention because the scan was unclear.
              </Text>
            </View>
          ) : null}

          <View style={styles.reviewToolbar}>
            <Text style={styles.panelLabel}>Metrics</Text>
            <Pressable
              onPress={confirmAll}
              accessibilityRole="button"
              accessibilityLabel="Confirm all extracted metrics"
            >
              <Text style={styles.confirmAllText}>Confirm all</Text>
            </Pressable>
          </View>

          {candidates.map((candidate) => (
            <CandidateRow
              key={`${candidateSession}:${candidate.localId}`}
              candidate={candidate}
              onToggle={() =>
                setCandidates((items) =>
                  toggleMetricCandidate(items, candidate.localId)
                )
              }
              onChange={(patch) =>
                setCandidates((items) =>
                  editMetricCandidate(items, candidate.localId, patch)
                )
              }
              onRemove={() =>
                setCandidates((items) =>
                  removeMetricCandidate(items, candidate.localId)
                )
              }
            />
          ))}

          <Pressable
            style={styles.manualAdd}
            onPress={addManual}
            accessibilityRole="button"
            accessibilityLabel="Add a metric manually"
          >
            <Ionicons name="add-circle" size={19} color={colors.primaryDark} />
            <Text style={styles.manualAddText}>Add a metric manually</Text>
          </Pressable>

          <View style={styles.saveFooter}>
            <View style={styles.saveSafety}>
              <Ionicons name="shield-checkmark" size={17} color={colors.primaryDark} />
              <Text style={styles.saveSafetyText}>
                Advice stays locked until at least one metric is confirmed.
              </Text>
            </View>
            <Pressable
              style={[
                styles.saveButton,
                (working || confirmedCount === 0) && styles.disabled,
              ]}
              onPress={saveConfirmed}
              disabled={working || confirmedCount === 0}
              accessibilityRole="button"
              accessibilityLabel="Save reviewed metrics and continue"
              accessibilityState={{
                disabled: working || confirmedCount === 0,
              }}
            >
              <Text style={styles.saveText}>
                Save {confirmedCount} confirmed & continue
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textOnColor} />
            </Pressable>
          </View>
        </Card>
      ) : null}

      <View style={styles.historyHeader}>
        <View>
          <Text style={type.h2}>Report history</Text>
          <Text style={styles.historySubtitle}>
            {reports.length} report{reports.length === 1 ? '' : 's'} · {totalAbnormal}{' '}
            flagged result{totalAbnormal === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.historyIcon}>
          <Ionicons name="time" size={20} color={colors.text} />
        </View>
      </View>

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
        <Card tone="muted" style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={26} color={colors.textMuted} />
          </View>
          <Text style={type.h3}>No reports yet</Text>
          <Text style={styles.empty}>
            Upload a report above to review its metrics and receive safe,
            non-diagnostic lifestyle suggestions.
          </Text>
        </Card>
      ) : null}

      {reports.map((report) => (
        <ReportHistoryCard
          key={report.id}
          report={report}
          onOpen={() =>
            router.push({ pathname: '/report/[id]', params: { id: report.id } })
          }
        />
      ))}
    </>
  )
}

function WorkflowSteps({ current }: { current: number }) {
  const steps = [
    { label: 'Choose', icon: 'cloud-upload-outline' as const },
    { label: 'Upload', icon: 'document-attach-outline' as const },
    { label: 'Read', icon: 'scan-outline' as const },
    { label: 'Confirm', icon: 'checkbox-outline' as const },
    { label: 'Advice', icon: 'sparkles-outline' as const },
  ]
  return (
    <View style={styles.steps} accessibilityLabel={`Report flow step ${current + 1} of 5`}>
      {steps.map((step, index) => {
        const complete = index < current
        const active = index === current
        return (
          <View key={step.label} style={styles.stepItem}>
            <View
              style={[
                styles.stepIcon,
                complete && styles.stepComplete,
                active && styles.stepActive,
              ]}
            >
              <Ionicons
                name={complete ? 'checkmark' : step.icon}
                size={16}
                color={active || complete ? colors.text : colors.textMuted}
              />
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
              {step.label}
            </Text>
            {index < steps.length - 1 ? (
              <View style={[styles.stepLine, index < current && styles.stepLineComplete]} />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function ActionButton({
  icon,
  label,
  detail,
  onPress,
  disabled = false,
}: {
  icon: 'camera' | 'images' | 'document-text'
  label: string
  detail: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={21} color={colors.text} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionDetail}>{detail}</Text>
    </Pressable>
  )
}

function SelectedFileCard({
  file,
  previewUri,
}: {
  file: SelectedFile
  previewUri: string | null
}) {
  return (
    <View style={styles.selectedFile}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.fileThumb} />
      ) : (
        <View style={styles.fileIcon}>
          <Ionicons name={sourceIcon[file.source]} size={24} color={colors.primaryDark} />
        </View>
      )}
      <View style={styles.flexBody}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.fileMeta}>
          {file.detail} · {file.sizeLabel}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} />
    </View>
  )
}

function ParsingProgress({ fileName }: { fileName: string }) {
  return (
    <View style={styles.parsingCard} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primaryDark} />
      <View style={styles.flexBody}>
        <Text style={styles.parsingTitle}>Reading report securely…</Text>
        <Text style={styles.parsingDetail} numberOfLines={1}>
          Looking for test names, values, units and printed reference ranges in {fileName}
        </Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </View>
  )
}

export function CandidateRow({
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
  const [value, setValue] = useState(
    Number.isFinite(candidate.value) ? String(candidate.value) : ''
  )
  const [unit, setUnit] = useState(candidate.unit)
  const [low, setLow] = useState(
    candidate.referenceLow === null || !Number.isFinite(candidate.referenceLow)
      ? ''
      : String(candidate.referenceLow)
  )
  const [high, setHigh] = useState(
    candidate.referenceHigh === null || !Number.isFinite(candidate.referenceHigh)
      ? ''
      : String(candidate.referenceHigh)
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
  const lowConfidence =
    candidate.confidence !== null && candidate.confidence < 0.7
  const candidateLabel = candidate.name || 'new metric'

  return (
    <View
      style={[
        styles.candidate,
        candidate.confirmed && styles.candidateConfirmed,
        lowConfidence && styles.lowConfidence,
      ]}
    >
      <View style={styles.candidateHeader}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityLabel={`Confirm ${candidateLabel}`}
          accessibilityState={{ checked: candidate.confirmed }}
          style={styles.confirmToggle}
        >
          <Ionicons
            name={candidate.confirmed ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={candidate.confirmed ? colors.primaryDark : colors.textMuted}
          />
          <Text style={styles.confirmToggleText}>
            {candidate.confirmed ? 'Confirmed' : 'Confirm'}
          </Text>
        </Pressable>
        {lowConfidence ? (
          <View style={styles.attentionBadge}>
            <Ionicons name="warning" size={13} color={colors.warning} />
            <Text style={styles.attentionText}>Check carefully</Text>
          </View>
        ) : null}
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${candidateLabel}`}
          style={styles.removeButton}
        >
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
        </Pressable>
      </View>

      <LabeledInput
        label="Metric name"
        accessibilityLabel={`Metric name for ${candidateLabel}`}
        value={name}
        onChangeText={(text) => {
          setName(text)
          commit({ name: text })
        }}
      />
      <View style={styles.fieldRow}>
        <LabeledInput
          label="Result"
          accessibilityLabel={`Result for ${candidateLabel}`}
          value={value}
          onChangeText={(text) => {
            setValue(text)
            commit({ value: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Unit"
          accessibilityLabel={`Unit for ${candidateLabel}`}
          value={unit}
          onChangeText={(text) => {
            setUnit(text)
            commit({ unit: text })
          }}
        />
      </View>
      <View style={styles.fieldRow}>
        <LabeledInput
          label="Reference low"
          accessibilityLabel={`Reference low for ${candidateLabel}`}
          value={low}
          onChangeText={(text) => {
            setLow(text)
            commit({ low: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Reference high"
          accessibilityLabel={`Reference high for ${candidateLabel}`}
          value={high}
          onChangeText={(text) => {
            setHigh(text)
            commit({ high: text })
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={statusIcon[status]}
          size={19}
          color={statusColors[status]}
        />
        <Text style={[styles.statusText, { color: statusColors[status] }]}>
          {statusLabel[status]}
        </Text>
        {candidate.confidence !== null ? (
          <Text style={styles.confidence}>
            {Math.round(candidate.confidence * 100)}% confidence
          </Text>
        ) : (
          <Text style={styles.confidence}>Manual entry</Text>
        )}
      </View>
      {candidate.uncertaintyReason ? (
        <Text style={styles.warning}>
          Why this needs review: {candidate.uncertaintyReason}
        </Text>
      ) : null}
    </View>
  )
}

export function LabeledInput({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string
  accessibilityLabel: string
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
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  )
}

function ReportHistoryCard({
  report,
  onOpen,
}: {
  report: HealthReport
  onOpen: () => void
}) {
  const displayedDate = report.reportDate ?? report.createdAt.slice(0, 10)
  const confirmed = report.metrics.filter((metric) => metric.confirmed)
  const unconfirmed = report.metrics.length - confirmed.length
  const flagged = confirmed.filter(
    (metric) => metric.status === 'low' || metric.status === 'high'
  ).length
  const lowConfidence = report.metrics.filter(
    (metric) => metric.confidence !== null && metric.confidence < 0.7
  ).length

  return (
    <Card style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportDocIcon}>
          <Ionicons name="document-text" size={22} color={colors.text} />
        </View>
        <View style={styles.flexBody}>
          <Text style={styles.reportTitle}>{report.name}</Text>
          <Text style={styles.reportMeta}>
            {displayedDate} · {report.metrics.length} total metrics
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </View>

      <View style={styles.summaryBadges}>
        <View style={styles.summaryBadge}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primaryDark} />
          <Text style={styles.summaryText}>{confirmed.length} confirmed</Text>
        </View>
        {unconfirmed > 0 ? (
          <View style={[styles.summaryBadge, styles.flaggedBadge]}>
            <Ionicons name="help-circle" size={15} color={colors.warning} />
            <Text style={styles.summaryText}>{unconfirmed} unconfirmed</Text>
          </View>
        ) : null}
        {lowConfidence > 0 ? (
          <View style={[styles.summaryBadge, styles.flaggedBadge]}>
            <Ionicons name="warning" size={15} color={colors.warning} />
            <Text style={styles.summaryText}>{lowConfidence} low confidence</Text>
          </View>
        ) : null}
        <View style={[styles.summaryBadge, flagged > 0 && styles.flaggedBadge]}>
          <Ionicons
            name={flagged > 0 ? 'warning' : 'shield-checkmark'}
            size={15}
            color={flagged > 0 ? colors.warning : colors.primaryDark}
          />
          <Text style={styles.summaryText}>
            {flagged > 0 ? `${flagged} outside range` : 'No confirmed flags'}
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.recButtonDark}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${report.name}`}
      >
        <Text style={styles.recButtonDarkText}>View report details</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.textOnColor} />
      </Pressable>
    </Card>
  )
}


export function DeleteReportModal({
  visible,
  onCancel,
  onConfirm,
  working = false,
}: {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
  working?: boolean
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.modalIcon}>
            <Ionicons name="trash-outline" size={25} color={colors.danger} />
          </View>
          <Text style={type.h2}>Delete this report?</Text>
          <Text style={styles.modalCopy}>
            This removes the report, all of its metrics and generated advice. This
            action cannot be undone.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel="Cancel report deletion"
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>Keep report</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel="Confirm delete report"
              style={[styles.modalDelete, working && styles.disabled]}
            >
              {working ? (
                <ActivityIndicator color={colors.textOnColor} />
              ) : (
                <Text style={styles.modalDeleteText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function MetricRow({ metric }: { metric: ReportMetric }) {
  const range =
    metric.referenceLow !== null && metric.referenceHigh !== null
      ? `${metric.referenceLow}–${metric.referenceHigh}`
      : metric.referenceLow !== null
        ? `≥ ${metric.referenceLow}`
        : metric.referenceHigh !== null
          ? `≤ ${metric.referenceHigh}`
          : 'No range printed'
  return (
    <View style={styles.metricRow}>
      <Ionicons
        name={metric.confirmed ? statusIcon[metric.status] : 'ellipse-outline'}
        size={20}
        color={metric.confirmed ? statusColors[metric.status] : colors.warning}
      />
      <View style={styles.metricBody}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricRange}>Report range: {range}</Text>
        {!metric.confirmed ? (
          <Text style={styles.warning}>Unconfirmed — not used for advice</Text>
        ) : null}
        {metric.confidence !== null && metric.confidence < 0.7 ? (
          <Text style={styles.warning}>
            Low confidence ({Math.round(metric.confidence * 100)}%) — check carefully
          </Text>
        ) : null}
        {metric.uncertaintyReason ? (
          <Text style={styles.metricRange}>{metric.uncertaintyReason}</Text>
        ) : null}
      </View>
      <View style={styles.metricValueBlock}>
        <Text style={styles.metricValue}>
          {metric.value}
          {metric.unit ? ` ${metric.unit}` : ''}
        </Text>
        <Text style={[styles.metricStatus, { color: statusColors[metric.status] }]}>
          {metric.confirmed ? statusLabel[metric.status] : 'Needs confirmation'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flexBody: { flex: 1, minWidth: 0 },
  smallText: { ...type.small, color: colors.text, marginTop: sp(1) },
  successCard: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(3) },
  steps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: sp(4),
    paddingHorizontal: sp(1),
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepActive: { borderColor: colors.text, backgroundColor: colors.yellow },
  stepComplete: { borderColor: colors.text, backgroundColor: colors.primary },
  stepLabel: { fontSize: 10, color: colors.textMuted, marginTop: sp(1), fontWeight: '700' },
  stepLabelActive: { color: colors.text, fontWeight: '900' },
  stepLine: {
    height: 2,
    backgroundColor: colors.border,
    position: 'absolute',
    top: 16,
    left: '68%',
    width: '64%',
    zIndex: 1,
  },
  stepLineComplete: { backgroundColor: colors.primaryDark },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(3) },
  intro: { ...type.body, marginTop: sp(2), color: colors.text },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  privateText: { fontSize: 11, color: colors.primaryDark, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginTop: sp(4) },
  actionButton: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(3),
  },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp(2),
  },
  actionLabel: { fontWeight: '900', color: colors.text },
  actionDetail: { ...type.small, marginTop: 2 },
  demoLink: {
    flexDirection: 'row',
    gap: sp(1),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sp(3),
    minHeight: 36,
  },
  demoLinkText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
  fixturePanel: {
    marginTop: sp(4),
    padding: sp(3),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 0,
  },
  fixtureHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
  },
  fixtureTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
  fixtureSubtitle: { ...type.small, marginTop: 2 },
  fixtureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
    marginTop: sp(3),
    minWidth: 0,
  },
  fixtureButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    minWidth: 0,
    minHeight: 74,
    padding: sp(2.5),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  fixtureButtonTitle: { color: colors.text, fontWeight: '900', fontSize: 12 },
  fixtureButtonSummary: {
    ...type.small,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  fileRules: { ...type.small, textAlign: 'center', marginTop: sp(1) },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    marginTop: sp(4),
    padding: sp(3),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileThumb: { width: 52, height: 52, borderRadius: radius.sm },
  fileIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { color: colors.text, fontWeight: '800' },
  fileMeta: { ...type.small, marginTop: 2 },
  parsingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    marginTop: sp(3),
    padding: sp(3),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  parsingTitle: { color: colors.text, fontWeight: '800' },
  parsingDetail: { ...type.small, marginTop: 2 },
  progressTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginTop: sp(2),
    overflow: 'hidden',
  },
  progressFill: { width: '64%', height: '100%', backgroundColor: colors.primaryDark },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    marginTop: sp(3),
    padding: sp(3),
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  message: { ...type.small, color: colors.text, flex: 1 },
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
  reviewHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(3) },
  hint: { ...type.small, marginTop: sp(1) },
  countBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: sp(2),
    paddingVertical: sp(1.5),
    borderRadius: radius.pill,
  },
  countText: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  reportDetailsPanel: {
    marginTop: sp(4),
    padding: sp(3),
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  panelLabel: { ...type.label, color: colors.text },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginTop: sp(2) },
  labeledInput: { flexGrow: 1, flexBasis: 150 },
  fieldLabel: { ...type.small, color: colors.textSecondary, marginBottom: sp(1) },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: sp(3),
    fontSize: 15,
  },
  futureNote: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: sp(2) },
  reviewAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    marginTop: sp(3),
    padding: sp(3),
    backgroundColor: '#FFF2D7',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E9C680',
  },
  reviewAlertText: { ...type.small, color: colors.text, flex: 1, fontWeight: '600' },
  reviewToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sp(4),
  },
  confirmAllText: { color: colors.primaryDark, fontWeight: '900', fontSize: 13 },
  candidate: {
    marginTop: sp(3),
    padding: sp(3),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  candidateConfirmed: { borderColor: colors.primaryDark, backgroundColor: '#F4FAF1' },
  lowConfidence: { borderColor: colors.warning, backgroundColor: '#FFF9EC' },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: sp(2), marginBottom: sp(3) },
  confirmToggle: { flexDirection: 'row', alignItems: 'center', gap: sp(1) },
  confirmToggleText: { fontSize: 12, color: colors.text, fontWeight: '800' },
  attentionBadge: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: '#FFF2D7',
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderRadius: radius.pill,
  },
  attentionText: { fontSize: 10, color: colors.warning, fontWeight: '900' },
  removeButton: { marginLeft: 'auto', padding: sp(1) },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: sp(1.5), marginTop: sp(3) },
  statusText: { ...type.small, fontWeight: '800' },
  confidence: { ...type.small, color: colors.textMuted, marginLeft: 'auto' },
  warning: { ...type.small, color: colors.warning, fontWeight: '700', marginTop: sp(2) },
  manualAdd: { flexDirection: 'row', alignItems: 'center', gap: sp(1), marginTop: sp(4) },
  manualAddText: { fontWeight: '800', color: colors.primaryDark },
  saveFooter: { marginTop: sp(4), paddingTop: sp(3), borderTopWidth: 1, borderTopColor: colors.border },
  saveSafety: { flexDirection: 'row', alignItems: 'center', gap: sp(2), marginBottom: sp(3) },
  saveSafetyText: { ...type.small, flex: 1 },
  saveButton: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: sp(2),
    paddingHorizontal: sp(3),
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.textOnColor, fontWeight: '900', textAlign: 'center' },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sp(2),
    marginBottom: sp(3),
  },
  historySubtitle: { ...type.small, marginTop: 2 },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flexDirection: 'row', gap: sp(2), alignItems: 'center', marginTop: sp(3) },
  progressText: { fontWeight: '700', color: colors.text },
  emptyCard: { alignItems: 'center' },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp(2),
  },
  empty: { ...type.small, textAlign: 'center', marginTop: sp(1) },
  errorText: { ...type.small, color: colors.danger, marginBottom: sp(2) },
  reportCard: { padding: sp(4) },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: sp(3) },
  reportDocIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  reportMeta: { ...type.small, marginTop: 2 },
  expandButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginTop: sp(3) },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
  },
  flaggedBadge: { backgroundColor: '#FFF2D7' },
  summaryText: { fontSize: 11, fontWeight: '800', color: colors.text },
  reportDetail: { marginTop: sp(4), paddingTop: sp(3), borderTopWidth: 1, borderTopColor: colors.border },
  subsectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verifiedLabel: { fontSize: 11, color: colors.primaryDark, fontWeight: '900' },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    paddingVertical: sp(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricBody: { flex: 1, minWidth: 0 },
  metricName: { fontSize: 14, fontWeight: '800', color: colors.text },
  metricRange: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  metricValueBlock: { alignItems: 'flex-end', maxWidth: '48%' },
  metricValue: { fontSize: 14, fontWeight: '900', color: colors.text, textAlign: 'right' },
  metricStatus: { fontSize: 10, fontWeight: '800', marginTop: 2, textAlign: 'right' },
  adviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sp(5),
    marginBottom: sp(3),
  },
  adviceSubtitle: { ...type.small, marginTop: 2 },
  recBlock: { gap: sp(3) },
  rec: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(3),
    padding: sp(3),
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  recIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  recDetail: { ...type.small, color: colors.textSecondary, marginTop: sp(1), lineHeight: 19 },
  evidenceBox: { marginTop: sp(3) },
  evidenceLabel: { ...type.label, fontSize: 9 },
  evidenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(1), marginTop: sp(1) },
  evidenceChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderWidth: 1,
    borderColor: colors.border,
  },
  evidenceText: { fontSize: 10, color: colors.text, fontWeight: '700' },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    padding: sp(3),
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  disclaimerTitle: { fontSize: 12, fontWeight: '900', color: colors.primaryDark },
  disclaimerText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
  adviceLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    padding: sp(3),
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  adviceLockedText: { ...type.small, flex: 1 },
  recActions: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginTop: sp(3) },
  recButton: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.text,
    flexDirection: 'row',
    gap: sp(2),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp(3),
  },
  recButtonText: { fontWeight: '800', color: colors.text },
  recButtonDark: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1),
    paddingHorizontal: sp(4),
    paddingVertical: sp(2),
  },
  recButtonDarkText: { color: colors.textOnColor, fontWeight: '900', fontSize: 14 },
  deleteLink: { flexDirection: 'row', gap: sp(1), alignItems: 'center', marginTop: sp(4) },
  deleteText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,33,29,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp(5),
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(5),
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FCE5DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp(3),
  },
  modalCopy: { ...type.body, marginTop: sp(2) },
  modalActions: { flexDirection: 'row', gap: sp(2), marginTop: sp(5) },
  modalCancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: colors.text, fontWeight: '800' },
  modalDelete: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: { color: colors.textOnColor, fontWeight: '900' },
})
