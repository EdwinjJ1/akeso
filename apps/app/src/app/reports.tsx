import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ReportManager } from '@/components/report/report-manager'
import { Screen } from '@/components/ui/screen'
import { colors, sp, type } from '@/theme/tokens'

export default function Reports() {
  const router = useRouter()
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={type.h1}>Health reports</Text>
      </View>
      <Text style={styles.lede}>
        Upload a lab or blood-test report, confirm what Akeso reads, and get safe, general
        lifestyle suggestions. Akeso is not a medical device and does not diagnose.
      </Text>
      <ReportManager />
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: sp(2), marginBottom: sp(2) },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  lede: { ...type.body, marginBottom: sp(4) },
})
