import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import {
  candidateStatus,
  parseRequiredMetricNumber,
  type ReportMetricCandidate,
} from '@/state/report-flow'
import { colors } from '@/theme/tokens'

import { styles } from './report-manager.styles'
import { statusColors, statusIcon, statusLabel, toNullableNumber } from './report-ui'

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
  const lowConfidence =
    candidate.confidence !== null && candidate.confidence < 0.7

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
          accessibilityLabel={`Confirm ${candidate.name}`}
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
          accessibilityLabel={`Remove ${candidate.name}`}
          style={styles.removeButton}
        >
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
        </Pressable>
      </View>

      <LabeledInput
        label="Metric name"
        accessibilityLabel={`Metric name for ${candidate.name}`}
        value={name}
        onChangeText={(text) => {
          setName(text)
          commit({ name: text })
        }}
      />
      <View style={styles.fieldRow}>
        <LabeledInput
          label="Result"
          accessibilityLabel={`Result for ${candidate.name}`}
          value={value}
          onChangeText={(text) => {
            setValue(text)
            commit({ value: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Unit"
          accessibilityLabel={`Unit for ${candidate.name}`}
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
          accessibilityLabel={`Reference low for ${candidate.name}`}
          value={low}
          onChangeText={(text) => {
            setLow(text)
            commit({ low: text })
          }}
          keyboardType="numeric"
        />
        <LabeledInput
          label="Reference high"
          accessibilityLabel={`Reference high for ${candidate.name}`}
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
