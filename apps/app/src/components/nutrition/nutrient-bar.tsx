import type { NutrientNeed } from '@akeso/domain'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, sp } from '@/theme/tokens'

interface NutrientBarProps {
  need: NutrientNeed
}

/** Progress toward one nutrient target for today */
export function NutrientBar({ need }: NutrientBarProps) {
  const ratio = Math.min(need.current / need.target, 1)
  const low = ratio < 0.5
  const barColor = low ? colors.coral : colors.primary

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{need.label}</Text>
        <Text style={styles.amount}>
          {need.current}
          {need.unit} / {need.target}
          {need.unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.max(ratio * 100, 4)}%`, backgroundColor: barColor }]}
        />
      </View>
      {need.note ? <Text style={styles.note}>{need.note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: sp(3.5),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: sp(1.5),
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  amount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  track: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    borderWidth: 1.5,
    borderColor: colors.text,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: sp(1),
  },
})
