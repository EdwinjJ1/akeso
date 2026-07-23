import type {
  HealthRecommendationSet,
  HealthReport,
  ReportMetric,
} from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import { colors, type } from '@/theme/tokens'

import { demoRecommendations } from './report-demo'
import { styles } from './report-manager.styles'
import { statusColors, statusIcon, statusLabel, useMountedRef } from './report-ui'

export function SavedReportCard({
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
  const isDemo = report.id === 'demo-health-report'
  const mounted = useMountedRef()
  const [recommendations, setRecommendations] =
    useState<HealthRecommendationSet | null>(isDemo ? demoRecommendations : null)
  const [expanded, setExpanded] = useState(isDemo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const runRecommendationTask = async (
    task: (id: string) => Promise<HealthRecommendationSet>,
    failureMessage: string
  ) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await task(report.id)
      if (!mounted.current) return
      setRecommendations(next)
      setExpanded(true)
    } catch (cause) {
      if (!mounted.current) return
      setError(cause instanceof Error ? cause.message : failureMessage)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const load = () =>
    runRecommendationTask(getRecommendations, 'Could not load recommendations.')

  const runRegenerate = () =>
    runRecommendationTask(regenerate, 'Could not regenerate recommendations.')

  const created = report.createdAt.slice(0, 10)
  const flagged = report.metrics.filter(
    (metric) => metric.status === 'low' || metric.status === 'high'
  ).length
  const metricById = new Map(report.metrics.map((metric) => [metric.id, metric]))

  return (
    <Card style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportDocIcon}>
          <Ionicons name="document-text" size={22} color={colors.text} />
        </View>
        <View style={styles.flexBody}>
          <Text style={styles.reportTitle}>
            {isDemo ? 'General pathology report' : 'Health report'}
          </Text>
          <Text style={styles.reportMeta}>
            {created} · {report.metrics.length} confirmed metrics
          </Text>
        </View>
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse report details' : 'View report details'}
          style={styles.expandButton}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.summaryBadges}>
        <View style={styles.summaryBadge}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primaryDark} />
          <Text style={styles.summaryText}>{report.metrics.length} confirmed</Text>
        </View>
        <View style={[styles.summaryBadge, flagged > 0 && styles.flaggedBadge]}>
          <Ionicons
            name={flagged > 0 ? 'warning' : 'shield-checkmark'}
            size={15}
            color={flagged > 0 ? colors.warning : colors.primaryDark}
          />
          <Text style={styles.summaryText}>
            {flagged > 0 ? `${flagged} outside range` : 'No flagged results'}
          </Text>
        </View>
      </View>

      {expanded ? (
        <View style={styles.reportDetail}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.panelLabel}>Confirmed results</Text>
            <Text style={styles.verifiedLabel}>User verified</Text>
          </View>
          {report.metrics.map((metric) => (
            <MetricRow key={metric.id} metric={metric} />
          ))}

          <View style={styles.adviceHeader}>
            <View>
              <Text style={type.h3}>Lifestyle guidance</Text>
              <Text style={styles.adviceSubtitle}>
                Safe suggestions grounded in confirmed results
              </Text>
            </View>
            <Ionicons name="sparkles" size={19} color={colors.primaryDark} />
          </View>

          {recommendations ? (
            <View style={styles.recBlock}>
              {recommendations.recommendations.map((rec) => {
                const evidence = rec.basedOnMetricIds
                  .map((id) => metricById.get(id))
                  .filter((metric): metric is ReportMetric => Boolean(metric))
                return (
                  <View key={rec.id} style={styles.rec}>
                    <View style={styles.recIcon}>
                      <Ionicons
                        name={
                          rec.category === 'follow_up'
                            ? 'medical'
                            : rec.category === 'hydration'
                              ? 'water'
                              : 'leaf'
                        }
                        size={18}
                        color={colors.text}
                      />
                    </View>
                    <View style={styles.flexBody}>
                      <Text style={styles.recTitle}>{rec.title}</Text>
                      <Text style={styles.recDetail}>{rec.detail}</Text>
                      <View style={styles.evidenceBox}>
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
                    </View>
                  </View>
                )
              })}
              <View style={styles.disclaimerCard}>
                <Ionicons name="medkit-outline" size={18} color={colors.primaryDark} />
                <View style={styles.flexBody}>
                  <Text style={styles.disclaimerTitle}>Not a medical diagnosis</Text>
                  <Text style={styles.disclaimerText}>
                    {recommendations.disclaimer}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.adviceLocked}>
              <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
              <Text style={styles.adviceLockedText}>
                Advice will appear here after confirmed metrics are loaded.
              </Text>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.recActions}>
            <Pressable
              style={[styles.recButton, busy && styles.disabled]}
              onPress={load}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="View report recommendations"
            >
              {busy ? <ActivityIndicator color={colors.text} /> : null}
              <Text style={styles.recButtonText}>
                {busy
                  ? 'Working…'
                  : recommendations
                    ? 'Refresh advice'
                    : 'View recommendations'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.recButtonDark, busy && styles.disabled]}
              onPress={runRegenerate}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Regenerate report recommendations"
            >
              <Ionicons name="sparkles" size={15} color={colors.textOnColor} />
              <Text style={styles.recButtonDarkText}>Regenerate</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setConfirmDelete(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete this health report"
            style={styles.deleteLink}
          >
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
            <Text style={styles.deleteText}>Delete report</Text>
          </Pressable>
        </View>
      ) : null}

      <DeleteReportModal
        visible={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          onDeleted()
        }}
      />
    </Card>
  )
}

function DeleteReportModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
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
            This removes the report, confirmed metrics and generated advice. This
            action cannot be undone.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel report deletion"
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>Keep report</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm delete report"
              style={styles.modalDelete}
            >
              <Text style={styles.modalDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
          : 'No range printed'
  return (
    <View style={styles.metricRow}>
      <Ionicons
        name={statusIcon[metric.status]}
        size={20}
        color={statusColors[metric.status]}
      />
      <View style={styles.metricBody}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricRange}>Report range: {range}</Text>
      </View>
      <View style={styles.metricValueBlock}>
        <Text style={styles.metricValue}>
          {metric.value}
          {metric.unit ? ` ${metric.unit}` : ''}
        </Text>
        <Text style={[styles.metricStatus, { color: statusColors[metric.status] }]}>
          {statusLabel[metric.status]}
        </Text>
      </View>
    </View>
  )
}
