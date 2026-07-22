import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { SectionHeader } from '@/components/ui/section-header'
import { colors, radius, sp, type } from '@/theme/tokens'

export default function More() {
  const router = useRouter()
  return (
    <Screen tabbed>
      <SectionHeader title="More" subtitle="Tools that support your energy beyond today." />

      <Card onPress={() => router.push('/reports')} tone="surface" style={styles.entry}>
        <View style={styles.icon}>
          <Ionicons name="document-text" size={22} color={colors.text} />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle}>Health reports</Text>
          <Text style={styles.entrySubtitle}>
            Upload a lab report, confirm the values, and get safe lifestyle suggestions.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>

      <Card tone="muted" style={styles.disclaimer}>
        <Ionicons name="medkit-outline" size={17} color={colors.primaryDark} />
        <Text style={styles.disclaimerText}>
          Akeso is an energy coach, not a medical device. Nothing here diagnoses a condition or
          replaces professional medical advice.
        </Text>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: sp(3) },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBody: { flex: 1 },
  entryTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  entrySubtitle: { ...type.small, marginTop: 2 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(2.5), padding: sp(4) },
  disclaimerText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, flex: 1 },
})
