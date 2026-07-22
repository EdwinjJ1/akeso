import type { PlanBlock } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Tag } from '@/components/ui/chips'
import { colors, energyColors, energySoftColors, radius, sp } from '@/theme/tokens'
import { formatHourLabel } from '@/utils/dates'

const BLOCK_ICONS: Record<PlanBlock['type'], keyof typeof Ionicons.glyphMap> = {
  focus: 'flash',
  light: 'mail',
  break: 'walk',
  meal: 'restaurant',
  recovery: 'leaf',
}

const BLOCK_LABELS: Record<PlanBlock['type'], string> = {
  focus: 'Deep work',
  light: 'Light work',
  break: 'Break',
  meal: 'Meal',
  recovery: 'Recovery',
}

interface PlanBlockCardProps {
  block: PlanBlock
  isLast?: boolean
  onUpdate: () => void
}

/** One row in the day timeline: time rail + block card */
export function PlanBlockCard({
  block,
  isLast = false,
  onUpdate,
}: PlanBlockCardProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const bandColor = energyColors[block.energyLevel]
  const blockBackground = block.type === 'focus'
    ? colors.primary
    : block.type === 'meal'
      ? colors.yellow
      : block.type === 'recovery'
        ? colors.blue
        : colors.surface

  return (
    <View style={styles.row}>
      <View style={styles.timeRail}>
        <Text style={styles.time}>{formatHourLabel(block.start)}</Text>
        <View style={[styles.dot, { backgroundColor: bandColor }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: blockBackground },
          block.status === 'completed' && styles.completedCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: energySoftColors[block.energyLevel] }]}>
            <Ionicons name={BLOCK_ICONS[block.type]} size={15} color={bandColor} />
          </View>
          <Text style={styles.typeLabel}>{BLOCK_LABELS[block.type]}</Text>
          <Text style={styles.duration}>
            {formatHourLabel(block.start)}–{formatHourLabel(block.end)}
          </Text>
        </View>
        <Text
          style={[
            styles.title,
            block.status === 'completed' && styles.completedTitle,
          ]}
        >
          {block.title}
        </Text>
        <Text style={styles.rationale}>{block.rationale}</Text>
        <View style={styles.tagRow}>
          <Tag
            label={`${block.energyLevel} energy`}
            color={bandColor}
            background={energySoftColors[block.energyLevel]}
          />
          {block.source === 'user' ? (
            <Tag
              label="Updated by you"
              color={colors.text}
              background={colors.lime}
            />
          ) : null}
          {block.status === 'completed' ? (
            <Tag
              label="Completed"
              color={colors.text}
              background={colors.primarySoft}
            />
          ) : null}
        </View>
        {block.source === 'user' ? (
          <>
            <Pressable
              onPress={() => setShowOriginal((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={
                showOriginal ? 'Hide original suggestion' : 'Show original suggestion'
              }
              style={styles.originalToggle}
            >
              <Text style={styles.originalToggleText}>
                {showOriginal ? 'Hide original' : 'Show original'}
              </Text>
            </Pressable>
            {showOriginal ? (
              <View style={styles.originalBox}>
                <Text style={styles.originalLabel}>AKESO’S ORIGINAL</Text>
                <Text style={styles.originalTitle}>
                  {block.originalSuggestion.title}
                </Text>
                <Text style={styles.originalTime}>
                  {block.originalSuggestion.start}–{block.originalSuggestion.end}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        <Pressable
          onPress={onUpdate}
          accessibilityRole="button"
          accessibilityLabel="Update"
          style={({ pressed }) => [
            styles.updateButton,
            pressed && styles.updatePressed,
          ]}
        >
          <Ionicons name="create-outline" size={15} color={colors.text} />
          <Text style={styles.updateText}>Update</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: sp(3),
  },
  timeRail: {
    width: 58,
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    marginBottom: sp(1),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.text,
  },
  line: {
    flex: 1,
    width: 2.5,
    backgroundColor: colors.text,
    marginTop: sp(1),
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderTopLeftRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(4),
    marginBottom: sp(3),
  },
  completedCard: { opacity: 0.82 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    marginBottom: sp(2),
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  duration: {
    fontSize: 12,
    color: colors.text,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  completedTitle: { textDecorationLine: 'line-through' },
  rationale: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: sp(2),
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(1.5),
  },
  originalToggle: { alignSelf: 'flex-start', marginTop: sp(2.5) },
  originalToggleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  originalBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: sp(2.5),
    marginTop: sp(2),
  },
  originalLabel: { fontSize: 10, fontWeight: '900', color: colors.textMuted },
  originalTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  originalTime: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  updateButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(1.5),
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginTop: sp(3),
    paddingHorizontal: sp(3),
  },
  updatePressed: { transform: [{ translateY: 2 }] },
  updateText: { color: colors.text, fontSize: 13, fontWeight: '900' },
})
