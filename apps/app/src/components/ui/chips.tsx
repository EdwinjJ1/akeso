import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, sp } from '@/theme/tokens'

export interface ChipOption<T extends string | number> {
  value: T
  label: string
}

interface ChipRowProps<T extends string | number> {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
}

/** Tappable single-select chips — used for all 1–5 scales in check-in */
export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: ChipRowProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

interface TagProps {
  label: string
  color?: string
  background?: string
}

/** Small non-interactive tag/badge */
export function Tag({ label, color = colors.textSecondary, background = colors.surfaceMuted }: TagProps) {
  return (
    <View style={[styles.tag, { backgroundColor: background }]}>
      <Text style={[styles.tagLabel, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
  },
  chip: {
    paddingVertical: sp(2.5),
    paddingHorizontal: sp(4),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.text,
    fontWeight: '800',
  },
  tag: {
    paddingVertical: sp(1),
    paddingHorizontal: sp(2.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(31,33,29,0.12)',
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
})
