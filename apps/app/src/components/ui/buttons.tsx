import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { colors, radius, sp } from '@/theme/tokens'

interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'cta' | 'ghost'
}

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: ButtonProps) {
  const backgroundStyle =
    variant === 'cta' ? styles.cta : variant === 'ghost' ? styles.ghost : styles.primary
  const labelStyle = variant === 'ghost' ? styles.ghostLabel : styles.solidLabel

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        backgroundStyle,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.text : colors.textOnColor} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: sp(3.5),
    paddingHorizontal: sp(6),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  primary: {
    backgroundColor: colors.text,
  },
  cta: {
    backgroundColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
    shadowOpacity: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  solidLabel: {
    color: colors.textOnColor,
    fontSize: 16,
    fontWeight: '800',
  },
  ghostLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
})
