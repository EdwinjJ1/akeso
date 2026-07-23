import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import { colors, type } from '@/theme/tokens'

import { CandidateRow, LabeledInput } from './candidate-row'
import { styles } from './report-manager.styles'
import {
  ActionButton,
  ParsingProgress,
  SelectedFileCard,
  WorkflowSteps,
} from './report-upload-panel'
import { SavedReportCard } from './saved-report-card'
import { useReportUpload } from './use-report-upload'

export function ReportManager() {
  const flow = useReportUpload()
  const {
    reports,
    loadingReports,
    listError,
    candidates,
    selectedFile,
    previewUri,
    retryImage,
    working,
    message,
    savedNotice,
  } = flow

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
            (metric) => metric.status === 'high' || metric.status === 'low'
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
              Only the metrics you confirmed were saved. Advice is now available
              in report history.
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
            onPress={flow.openCamera}
            disabled={working}
          />
          <ActionButton
            icon="images"
            label="Photos"
            detail="JPG or PNG"
            onPress={flow.openLibrary}
            disabled={working}
          />
          <ActionButton
            icon="document-text"
            label="Files"
            detail="PDF preview"
            onPress={flow.openPdf}
            disabled={working}
          />
        </View>

        <Pressable
          onPress={flow.showDemo}
          disabled={working}
          accessibilityRole="button"
          accessibilityLabel="Preview the full report flow with sample data"
          accessibilityState={{ disabled: working }}
          style={[styles.demoLink, working && styles.disabled]}
        >
          <Ionicons name="sparkles" size={16} color={colors.primaryDark} />
          <Text style={styles.demoLinkText}>Preview with a sample report</Text>
        </Pressable>

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
            onPress={flow.retryExtraction}
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
                file. Unconfirmed values will not be saved or used for advice.
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
                value={flow.reportName}
                onChangeText={flow.setReportName}
                accessibilityLabel="Report name"
              />
              <LabeledInput
                label="Report date"
                value={flow.reportDate}
                onChangeText={flow.setReportDate}
                accessibilityLabel="Report date"
              />
            </View>
            <Text style={styles.futureNote}>
              Report name and date are UI-only in this MVP and will be persisted
              when the report metadata API is added.
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
              onPress={flow.confirmAll}
              accessibilityRole="button"
              accessibilityLabel="Confirm all extracted metrics"
            >
              <Text style={styles.confirmAllText}>Confirm all</Text>
            </Pressable>
          </View>

          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.localId}
              candidate={candidate}
              onToggle={() => flow.toggleCandidate(candidate.localId)}
              onChange={(patch) => flow.changeCandidate(candidate.localId, patch)}
              onRemove={() => flow.removeCandidate(candidate.localId)}
            />
          ))}

          <Pressable
            style={styles.manualAdd}
            onPress={flow.addManual}
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
              onPress={flow.saveConfirmed}
              disabled={working || confirmedCount === 0}
              accessibilityRole="button"
              accessibilityLabel="Save confirmed metrics and continue"
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
          <Pressable onPress={flow.refreshReports} accessibilityRole="button">
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
        <SavedReportCard
          key={report.id}
          report={report}
          getRecommendations={flow.getReportRecommendations}
          regenerate={flow.regenerateReportRecommendations}
          onDeleted={() => flow.deleteSavedReport(report.id)}
        />
      ))}
    </>
  )
}
