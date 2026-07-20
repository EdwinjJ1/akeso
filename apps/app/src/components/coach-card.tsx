import type { CoachReply } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import { colors, sp } from '@/theme/tokens'

interface CoachCardProps {
  coach: CoachReply
  /** Show only the first suggestion (dashboard) or all (plan screen) */
  compact?: boolean
}

export function CoachCard({ coach, compact = false }: CoachCardProps) {
  const suggestions = compact ? coach.suggestions.slice(0, 1) : coach.suggestions

  return (
    <Card tone="ink" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={15} color={colors.textOnColor} />
        </View>
        <Text style={styles.headerText}>A note from Akeso</Text>
      </View>

      <Text style={styles.message}>{coach.message}</Text>

      {suggestions.map((suggestion) => (
        <View key={suggestion.id} style={styles.suggestion}>
          <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          <Text style={styles.suggestionDetail}>{suggestion.detail}</Text>
        </View>
      ))}

      <Text style={styles.disclaimer}>{coach.disclaimer}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { borderBottomRightRadius: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(2),
    marginBottom: sp(2.5),
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lime,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: {
    fontSize: 14,
    color: colors.textOnColor,
    lineHeight: 20,
  },
  suggestion: {
    backgroundColor: '#30332D',
    borderWidth: 1,
    borderColor: '#4A4D45',
    borderRadius: 12,
    padding: sp(3),
    marginTop: sp(2.5),
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lime,
  },
  suggestionDetail: {
    fontSize: 13,
    color: '#D8DACF',
    lineHeight: 18,
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 11,
    color: '#A9ACA2',
    marginTop: sp(3),
    lineHeight: 15,
  },
})
