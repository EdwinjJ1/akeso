import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ReportManager } from '@/components/report/report-manager'
import { Card } from '@/components/ui/card'
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
      <Card tone="muted" style={styles.safetyBanner}>
        <View style={styles.safetyIcon}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.safetyBody}>
          <Text style={styles.safetyTitle}>You review before Akeso advises</Text>
          <Text style={styles.safetyText}>
            Scanned values remain unconfirmed until you check them. Serious or unclear
            results should be discussed with a qualified healthcare professional.
          </Text>
        </View>
      </Card>
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
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(3),
    padding: sp(3.5),
  },
  safetyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBody: { flex: 1 },
  safetyTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
  safetyText: { ...type.small, marginTop: 2 },
})
