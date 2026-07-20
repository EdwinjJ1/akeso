import { Pressable, StyleSheet, Text } from 'react-native'

import { Card } from '@/components/ui/card'
import { colors, sp, type } from '@/theme/tokens'

interface DashboardLoadErrorProps {
  message: string
  onRetry(): Promise<void>
}

export function DashboardLoadError({ message, onRetry }: DashboardLoadErrorProps) {
  return (
    <Card tone="coral" style={styles.card}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        onPress={() => {
          void onRetry()
        }}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', gap: sp(3) },
  message: { ...type.body, color: colors.text, fontWeight: '700' },
  retry: {
    backgroundColor: colors.text,
    borderColor: colors.text,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: sp(4),
    paddingVertical: sp(2),
  },
  retryPressed: { transform: [{ translateY: 2 }] },
  retryText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
})
