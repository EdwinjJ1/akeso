import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { useAppState } from '@/state/app-state'
import { colors, sp, type } from '@/theme/tokens'

export default function Index() {
  const { profile, profileHydrated, profileHydrationError, reloadProfile } = useAppState()

  if (!profileHydrated) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={styles.message}>Restoring your Akeso…</Text>
      </View>
    )
  }

  if (profileHydrationError) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          {profileHydrationError}
        </Text>
        <Button label="Try again" onPress={() => void reloadProfile()} />
      </View>
    )
  }

  return <Redirect href={profile ? '/(tabs)' : '/welcome'} />
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(3),
    padding: sp(6),
    backgroundColor: colors.bg,
  },
  message: { ...type.small, color: colors.textSecondary },
  error: { ...type.body, color: colors.danger, textAlign: 'center' },
})
