import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { colors, radius, shadows, sp } from '@/theme/tokens'

interface CardProps {
  children: ReactNode
  style?: ViewStyle | ViewStyle[]
  onPress?: () => void
  tone?: 'surface' | 'primary' | 'muted' | 'ink' | 'green' | 'blue' | 'yellow' | 'coral' | 'quiet'
}

export function Card({ children, style, onPress, tone = 'surface' }: CardProps) {
  const toneStyle = tone === 'primary' || tone === 'green'
    ? styles.green
    : tone === 'muted' || tone === 'quiet'
      ? styles.quiet
      : tone === 'ink'
        ? styles.ink
        : tone === 'blue'
          ? styles.blue
          : tone === 'yellow'
            ? styles.yellow
            : tone === 'coral'
              ? styles.coral
              : styles.surface

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          toneStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={[styles.base, toneStyle, style]}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: sp(5),
    marginBottom: sp(4),
    ...shadows.card,
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  green: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  quiet: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  ink: { backgroundColor: colors.surfaceInk, borderWidth: 0 },
  blue: { backgroundColor: colors.blue, borderWidth: 1.5, borderColor: colors.borderStrong },
  yellow: { backgroundColor: colors.yellow, borderWidth: 1.5, borderColor: colors.borderStrong },
  coral: { backgroundColor: colors.coral, borderWidth: 1.5, borderColor: colors.borderStrong },
  pressed: {
    opacity: 0.92,
    transform: [{ translateY: 2 }],
  },
})
