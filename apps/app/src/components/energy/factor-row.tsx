import type { EnergyFactor } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, sp } from '@/theme/tokens'

const FACTOR_ICONS: Record<EnergyFactor['key'], keyof typeof Ionicons.glyphMap> = {
  reported_energy: 'flash',
  sleep_duration: 'moon',
  last_meal: 'restaurant',
  hydration: 'water',
}

interface FactorRowProps {
  factor: EnergyFactor
  /** When set, the row becomes a button that opens this factor's edit sheet. */
  onEdit?: (factor: EnergyFactor) => void
}

/**
 * One "why this score" row: icon, label, qualitative explanation. No factor
 * ever shows a point attribution — the scoring mechanics stay private.
 *
 * When `onEdit` is provided the row is tappable: every answer that fed the
 * score can be corrected in place, so the receipt is editable, not just a
 * read-out.
 */
export function FactorRow({ factor, onEdit }: FactorRowProps) {
  const content = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={FACTOR_ICONS[factor.key]} size={17} color={colors.primaryDark} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{factor.label}</Text>
        <Text style={styles.explanation}>{factor.explanation}</Text>
      </View>
      {onEdit ? (
        <Ionicons name="pencil" size={15} color={colors.textMuted} style={styles.editIcon} />
      ) : null}
    </>
  )

  if (!onEdit) return <View style={styles.row}>{content}</View>

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${factor.label}`}
      accessibilityHint="Opens a sheet to change this answer and recalculate your score"
      onPress={() => onEdit(factor)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
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
  rowPressed: { opacity: 0.55 },
  editIcon: { marginTop: 2, alignSelf: 'center' },
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
