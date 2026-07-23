import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'

import { colors } from '@/theme/tokens'

import { styles } from './report-manager.styles'
import { sourceIcon, type SelectedFile } from './report-ui'

export function WorkflowSteps({ current }: { current: number }) {
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

export function ActionButton({
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

export function SelectedFileCard({
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

export function ParsingProgress({ fileName }: { fileName: string }) {
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
