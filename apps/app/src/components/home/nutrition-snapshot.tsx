import type { NutritionPlan } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { NutrientBar } from '@/components/nutrition/nutrient-bar'
import { Card } from '@/components/ui/card'
import { colors, sp, type } from '@/theme/tokens'

interface NutritionSnapshotProps {
  nutrition: NutritionPlan
}

/** Dashboard summary: top nutrient gaps + the next recommended meal */
export function NutritionSnapshot({ nutrition }: NutritionSnapshotProps) {
  const topNeeds = [...nutrition.needs]
    .sort((a, b) => a.current / a.target - b.current / b.target)
    .slice(0, 2)
  const nextMeal = nutrition.meals[0]

  return (
    <Card tone="blue" style={styles.card}>
      <View style={styles.header}>
        <Text style={type.h3}>Today’s nutrition</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/nutrition')}
          style={styles.link}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>All meals</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text} />
        </Pressable>
      </View>

      {topNeeds.map((need) => (
        <NutrientBar key={need.key} need={need} />
      ))}

      {nextMeal ? (
        <View style={styles.mealRow}>
          <View style={styles.mealIcon}>
            <Ionicons name="restaurant" size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.mealText}>
            <Text style={styles.mealTitle}>{nextMeal.title}</Text>
            <Text style={styles.mealMeta}>
              Next up · {nextMeal.prepMinutes} min · from your fridge
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { borderTopRightRadius: 7, borderBottomLeftRadius: 34 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(4),
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(3),
    marginTop: sp(1),
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealText: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  mealMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
})
