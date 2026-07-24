import type { EnergyFactor } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors, sp } from '@/theme/tokens'

const FACTOR_ICONS: Record<EnergyFactor['key'], keyof typeof Ionicons.glyphMap> = {
  reported_energy: 'flash',
  sleep_duration: 'moon',
  last_meal: 'restaurant',
  hydration: 'water',
}

interface FactorRowProps {
  factor: EnergyFactor
}

/**
 * One "why this score" row: icon, label, qualitative explanation. No factor
 * ever shows a point attribution — the scoring mechanics stay private.
 */
export function FactorRow({ factor }: FactorRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={FACTOR_ICONS[factor.key]} size={17} color={colors.primaryDark} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{factor.label}</Text>
        <Text style={styles.explanation}>{factor.explanation}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: sp(2.5),
    gap: sp(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  explanation: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 1,
  },
})
