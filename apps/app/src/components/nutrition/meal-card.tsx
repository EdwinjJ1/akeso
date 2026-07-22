import type { FoodAllergen, FridgeItem, MealRecommendation } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { Tag } from '@/components/ui/chips'
import { colors, radius, sp } from '@/theme/tokens'

const SLOT_LABELS: Record<MealRecommendation['slot'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const ALLERGEN_LABELS: Record<FoodAllergen, string> = {
  peanuts: 'peanuts',
  tree_nuts: 'tree nuts',
  milk: 'milk',
  eggs: 'eggs',
  soy: 'soy',
  wheat_gluten: 'wheat/gluten',
  fish: 'fish',
  shellfish: 'shellfish',
  sesame: 'sesame',
}

interface MealCardProps {
  meal: MealRecommendation
  fridge: FridgeItem[]
}

/** One recommended meal, showing which fridge items it uses */
export function MealCard({ meal, fridge }: MealCardProps) {
  const fridgeNames = meal.usesFridgeItemIds
    .map((id) => fridge.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const background = meal.slot === 'breakfast'
    ? colors.yellow
    : meal.slot === 'lunch'
      ? colors.primary
      : meal.slot === 'snack'
        ? colors.blue
        : colors.coral

  return (
    <View style={[styles.card, { backgroundColor: background }]}> 
      <View style={styles.header}>
        <Text style={styles.slot}>{SLOT_LABELS[meal.slot]}</Text>
        <View style={styles.prep}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.prepText}>{meal.prepMinutes} min</Text>
        </View>
      </View>

      <Text style={styles.title}>{meal.title}</Text>
      <Text style={styles.description}>{meal.description}</Text>

      {fridgeNames.length > 0 ? (
        <View style={styles.fridgeRow}>
          <Ionicons name="snow-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.fridgeText}>From your fridge: {fridgeNames.join(', ')}</Text>
        </View>
      ) : null}

      {meal.allergenTags.length > 0 ? (
        <View style={styles.allergenRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.allergenText}>
            Contains: {meal.allergenTags.map((tag) => ALLERGEN_LABELS[tag]).join(', ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.tagRow}>
        {meal.tags.map((tag) => (
          <Tag key={tag} label={tag} color={colors.primaryDark} background={colors.primarySoft} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.text,
    padding: sp(5),
    marginBottom: sp(4),
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(1.5),
  },
  slot: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  prep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prepText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },
  fridgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1.5),
    marginTop: sp(2.5),
  },
  fridgeText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  allergenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1.5),
    marginTop: sp(2),
  },
  allergenText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(1.5),
    marginTop: sp(2.5),
  },
})
