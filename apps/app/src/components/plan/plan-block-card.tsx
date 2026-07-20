import type { PlanBlock } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

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
}

/** One row in the day timeline: time rail + block card */
export function PlanBlockCard({ block, isLast = false }: PlanBlockCardProps) {
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

      <View style={[styles.card, { backgroundColor: blockBackground }]}> 
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: energySoftColors[block.energyLevel] }]}>
            <Ionicons name={BLOCK_ICONS[block.type]} size={15} color={bandColor} />
          </View>
          <Text style={styles.typeLabel}>{BLOCK_LABELS[block.type]}</Text>
          <Text style={styles.duration}>
            {formatHourLabel(block.start)}–{formatHourLabel(block.end)}
          </Text>
        </View>
        <Text style={styles.title}>{block.title}</Text>
        <Text style={styles.rationale}>{block.rationale}</Text>
        <View style={styles.tagRow}>
          <Tag
            label={`${block.energyLevel} energy`}
            color={bandColor}
            background={energySoftColors[block.energyLevel]}
          />
        </View>
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
  rationale: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: sp(2),
  },
  tagRow: {
    flexDirection: 'row',
    gap: sp(1.5),
  },
})
