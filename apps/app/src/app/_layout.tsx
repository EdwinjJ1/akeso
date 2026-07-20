import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { AppStateProvider } from '@/state/app-state'
import { colors } from '@/theme/tokens'

export default function RootLayout() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
      </Stack>
    </AppStateProvider>
  )
}
