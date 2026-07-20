import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { Card } from '@/components/ui/card'
import { Mascot } from '@/components/mascot'
import { colors, sp } from '@/theme/tokens'

interface CheckInPromptProps {
  mode: 'first' | 'daily'
}

/** Hero card shown on the dashboard before today's check-in */
export function CheckInPrompt({ mode }: CheckInPromptProps) {
  const returning = mode === 'daily'
  const kicker = returning ? 'A QUICK DAILY REFRESH' : '20 SECONDS, THAT’S IT'
  const title = returning ? 'Update today’s status' : 'How’s your energy, really?'
  const subtitle = returning
    ? 'Your last answers are ready — only change what feels different today.'
    : 'A 20-second check-in unlocks your energy score, today’s plan, and meals matched to what your body needs.'
  const buttonLabel = returning ? 'Update today’s status' : 'Start check-in'

  return (
    <Card tone="green" style={styles.card}>
      <View style={styles.mascot}><Mascot state="steady" size={120} /></View>
      <View style={styles.iconCircle}>
        <Ionicons name="sunny" size={20} color={colors.text} />
      </View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Button label={buttonLabel} onPress={() => router.push('/checkin')} variant="cta" />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'stretch',
    paddingVertical: sp(7),
    overflow: 'hidden',
    borderTopLeftRadius: 8,
  },
  mascot: { position: 'absolute', right: -16, top: -12 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: sp(4),
  },
  title: {
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'left',
    maxWidth: '68%',
  },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: sp(2), color: colors.text },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'left',
    marginTop: sp(2),
    marginBottom: sp(5),
  },
})
