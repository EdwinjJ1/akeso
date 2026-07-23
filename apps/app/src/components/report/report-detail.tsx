import {
  localDateSchema,
  updateReportMetricsRequestSchema,
  updateReportRequestSchema,
  type HealthRecommendationSet,
  type HealthReport,
  type ReportMetric,
} from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { useAppState } from '@/state/app-state'
import {
  addBlankManualMetricCandidate,
  candidatesFromReportMetrics,
  editMetricCandidate,
  hasDuplicateReportCandidates,
  hasInvalidReportCandidates,
  removeMetricCandidate,
  toReviewedReportMetrics,
  toggleMetricCandidate,
  type ReportMetricCandidate,
} from '@/state/report-flow'
import { colors, radius, sp, type } from '@/theme/tokens'

import {
  CandidateRow,
  DeleteReportModal,
  LabeledInput,
  MetricRow,
} from './report-manager'

interface ReportDetailProps {
  reportId: string
  onBack: () => void
  onDeleted: () => void
}

export function ReportDetail({
  reportId,
  onBack,
  onDeleted,
}: ReportDetailProps) {
  const {
    getReport,
    updateReport,
    updateReportMetrics,
    deleteReport,
    getReportRecommendations,
    regenerateReportRecommendations,
  } = useAppState()

  const [report, setReport] = useState<HealthReport | null>(null)
  const [recommendations, setRecommendations] =
    useState<HealthRecommendationSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adviceError, setAdviceError] = useState<string | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [persistedAdviceStale, setPersistedAdviceStale] = useState(false)
  const loadGeneration = useRef(0)

  const [name, setName] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [candidates, setCandidates] = useState<ReportMetricCandidate[]>([])
  const [metadataDirty, setMetadataDirty] = useState(false)
  const [metricsDirty, setMetricsDirty] = useState(false)

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current
    setLoading(true)
    setReport(null)
    setRecommendations(null)
    setLoadError(null)
    setAdviceError(null)
    setAdviceLoading(false)
    setEditing(false)
    setMetadataDirty(false)
    setMetricsDirty(false)
    setPersistedAdviceStale(false)
    try {
      const loaded = await getReport(reportId)
      if (generation !== loadGeneration.current) return
      setReport(loaded)
      setName(loaded.name)
      setReportDate(loaded.reportDate ?? '')
      setCandidates(candidatesFromReportMetrics(loaded.metrics))
      setLoading(false)
      setAdviceLoading(true)
      try {
        const loadedRecommendations = await getReportRecommendations(reportId)
        if (generation !== loadGeneration.current) return
        setRecommendations(loadedRecommendations)
      } catch (error) {
        if (generation !== loadGeneration.current) return
        setAdviceError(
          error instanceof Error
            ? error.message
            : 'Could not load this report\'s advice.'
        )
      } finally {
        if (generation === loadGeneration.current) setAdviceLoading(false)
      }
    } catch (error) {
      if (generation !== loadGeneration.current) return
      setLoadError(
        error instanceof Error ? error.message : 'Could not load this report.'
      )
    } finally {
      if (generation === loadGeneration.current) setLoading(false)
    }
  }, [getReport, getReportRecommendations, reportId])

  useEffect(() => {
    // This effect intentionally bootstraps remote route data on id changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => {
      loadGeneration.current += 1
    }
  }, [load])

  const beginEditing = () => {
    if (!report) return
    setName(report.name)
    setReportDate(report.reportDate ?? '')
    setCandidates(candidatesFromReportMetrics(report.metrics))
    setMetadataDirty(false)
    setMetricsDirty(false)
    setMessage(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    if (report) {
      setName(report.name)
      setReportDate(report.reportDate ?? '')
      setCandidates(candidatesFromReportMetrics(report.metrics))
    }
    setMetadataDirty(false)
    setMetricsDirty(false)
    setMessage(null)
    setEditing(false)
  }

  const changeCandidates = (
    updater: (items: ReportMetricCandidate[]) => ReportMetricCandidate[]
  ) => {
    setCandidates((items) => updater(items))
    setMetricsDirty(true)
    setMessage(null)
  }

  const saveChanges = async () => {
    if (!report) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage('Enter a report name.')
      return
    }
    const normalizedDate = reportDate.trim()
    if (normalizedDate && !localDateSchema.safeParse(normalizedDate).success) {
      setMessage('Use a valid report date in YYYY-MM-DD format.')
      return
    }
    if (hasInvalidReportCandidates(candidates)) {
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
      setMessage('Confirm at least one valid metric before saving.')
      return
    }
    const metadataPatch = updateReportRequestSchema.safeParse({
      name: trimmedName,
      reportDate: normalizedDate || null,
    })
    const metricsPatch = updateReportMetricsRequestSchema.safeParse({ metrics })
    if (!metadataPatch.success || !metricsPatch.success) {
      setMessage(
        'Check the report name, metric names, units, values and reference ranges.'
      )
      return
    }

    setWorking(true)
    setMessage(null)
    setAdviceError(null)
    try {
      let updated = report
      if (metadataDirty) {
        updated = await updateReport(report.id, metadataPatch.data)
        setReport(updated)
        setMetadataDirty(false)
      }
      if (metricsDirty) {
        updated = await updateReportMetrics(report.id, metricsPatch.data)
        setReport(updated)
        setMetricsDirty(false)
        setPersistedAdviceStale(true)
      }
      setReport(updated)
      setName(updated.name)
      setReportDate(updated.reportDate ?? '')
      setCandidates(candidatesFromReportMetrics(updated.metrics))
      setEditing(false)

      if (metricsDirty || persistedAdviceStale) {
        try {
          const regenerated = await regenerateReportRecommendations(report.id)
          setRecommendations(regenerated)
          setPersistedAdviceStale(false)
          setMessage('Changes confirmed. Advice was regenerated from current metrics.')
        } catch (error) {
          // The report update is already durable. Keep the stale marker visible
          // and offer an explicit retry rather than pretending advice is current.
          setPersistedAdviceStale(true)
          setAdviceError(
            error instanceof Error
              ? error.message
              : 'Report saved, but advice could not be regenerated.'
          )
        }
      } else {
        setMessage('Report details updated.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save changes.')
    } finally {
      setWorking(false)
    }
  }

  const regenerate = async () => {
    setWorking(true)
    setAdviceError(null)
    try {
      setRecommendations(await regenerateReportRecommendations(reportId))
      setPersistedAdviceStale(false)
      setMessage('Advice regenerated from current confirmed metrics.')
    } catch (error) {
      setAdviceError(
        error instanceof Error ? error.message : 'Could not regenerate advice.'
      )
    } finally {
      setWorking(false)
    }
  }

  const remove = async () => {
    setWorking(true)
    setMessage(null)
    try {
      await deleteReport(reportId)
      setConfirmDelete(false)
      onDeleted()
    } catch (error) {
      setConfirmDelete(false)
      setMessage(error instanceof Error ? error.message : 'Could not delete report.')
      setWorking(false)
    }
  }

  const confirmedCount = report?.metrics.filter((metric) => metric.confirmed).length ?? 0
  const unconfirmedCount = (report?.metrics.length ?? 0) - confirmedCount
  const lowConfidenceCount =
    report?.metrics.filter(
      (metric) => metric.confidence !== null && metric.confidence < 0.7
    ).length ?? 0
  const adviceNeedsUpdate = persistedAdviceStale || metricsDirty
  const recommendationMetricById = useMemo(
    () =>
      new Map(
        (recommendations?.metrics ?? []).map((metric) => [metric.id, metric])
      ),
    [recommendations]
  )

  if (loading) {
    return (
      <Screen>
        <DetailHeader title="Health report" onBack={onBack} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.muted}>Loading report details…</Text>
        </View>
      </Screen>
    )
  }

  if (!report || loadError) {
    return (
      <Screen>
        <DetailHeader title="Health report" onBack={onBack} />
        <Card tone="muted">
          <Text style={type.h3}>Report unavailable</Text>
          <Text style={styles.muted}>{loadError ?? 'Report not found.'}</Text>
          <Pressable style={styles.secondaryButton} onPress={load}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <DetailHeader title={report.name} onBack={onBack} />

      {message ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle" size={18} color={colors.primaryDark} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <Card tone="blue">
        <View style={styles.sectionHeading}>
          <View style={styles.flex}>
            <Text style={type.h2}>Report information</Text>
            <Text style={styles.muted}>
              Uploaded {report.createdAt.slice(0, 10)}
            </Text>
          </View>
          {!editing ? (
            <Pressable
              onPress={beginEditing}
              accessibilityRole="button"
              accessibilityLabel="Edit report details and metrics"
              style={styles.editButton}
            >
              <Ionicons name="create-outline" size={17} color={colors.text} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.fieldGroup}>
            <LabeledInput
              label="Report name"
              accessibilityLabel="Report name"
              value={name}
              onChangeText={(value) => {
                setName(value)
                setMetadataDirty(true)
              }}
            />
            <LabeledInput
              label="Report date"
              accessibilityLabel="Report date"
              value={reportDate}
              onChangeText={(value) => {
                setReportDate(value)
                setMetadataDirty(true)
              }}
            />
          </View>
        ) : (
          <View style={styles.infoGrid}>
            <Info label="Report name" value={report.name} />
            <Info label="Report date" value={report.reportDate ?? 'Not provided'} />
          </View>
        )}

        <View style={styles.badges}>
          <Badge icon="checkmark-circle" text={`${confirmedCount} confirmed`} />
          {unconfirmedCount > 0 ? (
            <Badge icon="help-circle" text={`${unconfirmedCount} unconfirmed`} warning />
          ) : null}
          {lowConfidenceCount > 0 ? (
            <Badge icon="warning" text={`${lowConfidenceCount} low confidence`} warning />
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeading}>
          <View style={styles.flex}>
            <Text style={type.h2}>All metrics</Text>
            <Text style={styles.muted}>
              Unconfirmed values are visible but never used for advice.
            </Text>
          </View>
        </View>

        {editing
          ? candidates.map((candidate) => (
              <CandidateRow
                key={candidate.localId}
                candidate={candidate}
                onToggle={() =>
                  changeCandidates((items) =>
                    toggleMetricCandidate(items, candidate.localId)
                  )
                }
                onChange={(patch) =>
                  changeCandidates((items) =>
                    editMetricCandidate(items, candidate.localId, patch)
                  )
                }
                onRemove={() =>
                  changeCandidates((items) =>
                    removeMetricCandidate(items, candidate.localId)
                  )
                }
              />
            ))
          : report.metrics.map((metric) => (
              <MetricRow key={metric.id} metric={metric} />
            ))}

        {editing ? (
          <Pressable
            style={styles.addButton}
            onPress={() =>
              changeCandidates(addBlankManualMetricCandidate)
            }
            accessibilityRole="button"
            accessibilityLabel="Add another report metric"
          >
            <Ionicons name="add-circle" size={18} color={colors.primaryDark} />
            <Text style={styles.addButtonText}>Add metric</Text>
          </Pressable>
        ) : null}
      </Card>

      {adviceNeedsUpdate ? (
        <Card tone="muted" style={styles.staleCard}>
          <Ionicons name="refresh-circle" size={24} color={colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.staleTitle}>Advice needs updating</Text>
            <Text style={styles.muted}>
              The guidance below still reflects the previous confirmed values.
              {editing
                ? ' Confirm your edits to regenerate it.'
                : ' Retry regeneration below before relying on it.'}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card style={adviceNeedsUpdate ? styles.staleAdvice : undefined}>
        <View style={styles.sectionHeading}>
          <View style={styles.flex}>
            <Text style={type.h2}>Lifestyle guidance</Text>
            <Text style={styles.muted}>Based only on currently confirmed metrics</Text>
          </View>
          <Ionicons name="sparkles" size={20} color={colors.primaryDark} />
        </View>

        {adviceLoading ? (
          <View style={styles.adviceLoading}>
            <ActivityIndicator color={colors.primaryDark} />
            <Text style={styles.muted}>Loading guidance…</Text>
          </View>
        ) : recommendations ? (
          recommendations.recommendations.map((recommendation) => {
            const evidence = recommendation.basedOnMetricIds
              .map((id) => recommendationMetricById.get(id))
              .filter((metric): metric is ReportMetric => Boolean(metric))
            return (
              <View key={recommendation.id} style={styles.recommendation}>
                <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                <Text style={styles.recommendationText}>{recommendation.detail}</Text>
                <Text style={styles.evidenceLabel}>BASED ON CONFIRMED</Text>
                <View style={styles.evidenceList}>
                  {evidence.map((metric) => (
                    <View key={metric.id} style={styles.evidenceChip}>
                      <Text style={styles.evidenceText}>
                        {metric.name}: {metric.value}
                        {metric.unit ? ` ${metric.unit}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })
        ) : (
          <Text style={styles.muted}>Advice is not available yet.</Text>
        )}

        {recommendations ? (
          <View style={styles.disclaimer}>
            <Ionicons name="medkit-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.disclaimerText}>{recommendations.disclaimer}</Text>
          </View>
        ) : null}
        {adviceError ? <Text style={styles.error}>{adviceError}</Text> : null}
        {!editing ? (
          <Pressable
            style={[styles.secondaryButton, working && styles.disabled]}
            onPress={regenerate}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel={
              adviceNeedsUpdate ? 'Retry advice regeneration' : 'Regenerate report advice'
            }
          >
            {working ? <ActivityIndicator color={colors.text} /> : null}
            <Text style={styles.secondaryButtonText}>
              {adviceNeedsUpdate ? 'Retry advice update' : 'Regenerate advice'}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {editing ? (
        <View style={styles.editActions}>
          <Pressable
            style={styles.cancelButton}
            onPress={cancelEditing}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel="Cancel report changes"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, working && styles.disabled]}
            onPress={saveChanges}
            disabled={working || (!metadataDirty && !metricsDirty)}
            accessibilityRole="button"
            accessibilityLabel="Save report changes and regenerate advice"
          >
            {working ? <ActivityIndicator color={colors.textOnColor} /> : null}
            <Text style={styles.saveButtonText}>
              {metricsDirty ? 'Confirm & regenerate' : 'Save details'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirmDelete(true)}
          disabled={working}
          accessibilityRole="button"
          accessibilityLabel="Delete this health report"
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Delete report</Text>
        </Pressable>
      )}

      <DeleteReportModal
        visible={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        working={working}
      />
    </Screen>
  )
}

function DetailHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to report history"
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={[type.h1, styles.headerTitle]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function Badge({
  icon,
  text,
  warning = false,
}: {
  icon: 'checkmark-circle' | 'help-circle' | 'warning'
  text: string
  warning?: boolean
}) {
  return (
    <View style={[styles.badge, warning && styles.warningBadge]}>
      <Ionicons
        name={icon}
        size={15}
        color={warning ? colors.warning : colors.primaryDark}
      />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    marginBottom: sp(4),
  },
  headerTitle: { flex: 1 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(2),
  },
  muted: { ...type.small, color: colors.textMuted, marginTop: sp(1) },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    padding: sp(3),
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    marginBottom: sp(3),
  },
  messageText: { ...type.small, flex: 1, color: colors.text },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(3),
    marginBottom: sp(3),
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: sp(3),
    paddingVertical: sp(1.5),
    backgroundColor: colors.surface,
  },
  editButtonText: { fontWeight: '900', color: colors.text, fontSize: 13 },
  fieldGroup: { gap: sp(2) },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2) },
  info: {
    flexGrow: 1,
    flexBasis: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: sp(3),
    backgroundColor: colors.surface,
  },
  infoLabel: { ...type.small, color: colors.textMuted },
  infoValue: { ...type.body, color: colors.text, fontWeight: '800', marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(1.5), marginTop: sp(3) },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  warningBadge: { backgroundColor: colors.yellow },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1.5),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    borderRadius: radius.md,
    padding: sp(3),
    marginTop: sp(2),
  },
  addButtonText: { color: colors.primaryDark, fontWeight: '900' },
  staleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(3) },
  staleTitle: { fontWeight: '900', color: colors.text, fontSize: 15 },
  staleAdvice: { opacity: 0.62 },
  recommendation: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: sp(3),
  },
  adviceLoading: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(2),
  },
  recommendationTitle: { ...type.body, color: colors.text, fontWeight: '900' },
  recommendationText: { ...type.small, color: colors.text, marginTop: sp(1) },
  evidenceLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: sp(2),
  },
  evidenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(1), marginTop: sp(1) },
  evidenceChip: {
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  evidenceText: { fontSize: 11, fontWeight: '800', color: colors.text },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: sp(3),
    marginTop: sp(2),
  },
  disclaimerText: { ...type.small, flex: 1, color: colors.text },
  error: { ...type.small, color: colors.danger, marginTop: sp(2), fontWeight: '800' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(2),
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: sp(4),
    paddingVertical: sp(2.5),
    marginTop: sp(3),
  },
  secondaryButtonText: { color: colors.text, fontWeight: '900' },
  editActions: { flexDirection: 'row', gap: sp(2), marginBottom: sp(4) },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: sp(3),
  },
  cancelButtonText: { color: colors.text, fontWeight: '900' },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp(2),
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: sp(3),
  },
  saveButtonText: { color: colors.textOnColor, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1.5),
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: sp(3),
    marginBottom: sp(4),
  },
  deleteText: { color: colors.danger, fontWeight: '900' },
})
