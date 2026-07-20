import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { MealCard } from '@/components/nutrition/meal-card'
import { NutrientBar } from '@/components/nutrition/nutrient-bar'
import { Card } from '@/components/ui/card'
import { Tag } from '@/components/ui/chips'
import { Screen } from '@/components/ui/screen'
import { SectionHeader } from '@/components/ui/section-header'
import { Reveal } from '@/components/ui/reveal'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

type Mode = 'fridge' | 'needs'

export default function Nutrition() {
  const { nutrition } = useAppState()
  const [mode, setMode] = useState<Mode>('fridge')

  if (!nutrition) {
    return (
      <Screen tabbed>
        <SectionHeader
          title="Nutrition"
          subtitle="Loading today’s recommendations…"
        />
      </Screen>
    )
  }

  const fridgeSection = (
    <Card>
      <Text style={type.h3}>In your fridge</Text>
      <View style={styles.fridgeChips}>
        {nutrition.fridge.map((item) => (
          <Tag key={item.id} label={item.name} />
        ))}
      </View>
      <Text style={styles.fridgeHint}>
        Editing your fridge (and receipt scanning) lands in a later round.
      </Text>
    </Card>
  )

  const needsSection = (
    <Card>
      <Text style={type.h3}>What your body needs today</Text>
      <View style={styles.needsList}>
        {nutrition.needs.map((need) => (
          <NutrientBar key={need.key} need={need} />
        ))}
      </View>
    </Card>
  )

  return (
    <Screen tabbed>
      <Reveal>
        <View style={styles.hero}>
          <View style={styles.heroBlobLarge} />
          <View style={styles.heroBlobSmall} />
          <Text style={styles.heroKicker}>FUEL THE RHYTHM</Text>
          <Text style={styles.heroTitle}>EAT FOR{`\n`}THE DAY{`\n`}YOU HAVE.</Text>
          <Text style={styles.heroSubtitle}>Meals matched to today’s energy, built from what’s already nearby.</Text>
        </View>
      </Reveal>

      <Reveal delay={70}>
      <View style={styles.segment}>
        {(
          [
            { value: 'fridge', label: 'From my fridge' },
            { value: 'needs', label: 'For my needs' },
          ] as { value: Mode; label: string }[]
        ).map((option) => {
          const active = mode === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => setMode(option.value)}
              style={[styles.segmentButton, active && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      </Reveal>

      <Reveal delay={130}>
        {mode === 'fridge' ? fridgeSection : needsSection}
        {mode === 'fridge' ? needsSection : fridgeSection}
      </Reveal>

      <Text style={styles.mealsTitle}>Recommended today</Text>
      {nutrition.meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} fridge={nutrition.fridge} />
      ))}

      <Card tone="muted" style={styles.rationaleCard}>
        <Ionicons name="information-circle" size={17} color={colors.primaryDark} />
        <Text style={styles.rationaleText}>{nutrition.rationale}</Text>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 310,
    backgroundColor: colors.primary,
    borderRadius: 34,
    borderBottomLeftRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.text,
    overflow: 'hidden',
    padding: sp(5),
    marginBottom: sp(5),
  },
  heroBlobLarge: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: colors.yellow, right: -48, top: -36,
    borderWidth: 1.5, borderColor: colors.text,
  },
  heroBlobSmall: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.blue, right: 45, bottom: -28,
    borderWidth: 1.5, borderColor: colors.text,
  },
  heroKicker: { ...type.label, color: colors.text, marginBottom: sp(3), zIndex: 2 },
  heroTitle: { fontSize: 42, lineHeight: 40, letterSpacing: -2, fontWeight: '900', color: colors.text, zIndex: 2 },
  heroSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.text, maxWidth: 220, marginTop: sp(4), zIndex: 2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    padding: 5,
    borderWidth: 1.5,
    borderColor: colors.text,
    marginBottom: sp(4),
  },
  segmentButton: {
    flex: 1,
    paddingVertical: sp(2.5),
    borderRadius: radius.pill,
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.lime,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#AEB0A8',
  },
  segmentLabelActive: {
    color: colors.text,
    fontWeight: '900',
  },
  fridgeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
    marginTop: sp(3),
  },
  fridgeHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: sp(3),
  },
  needsList: {
    marginTop: sp(3),
  },
  mealsTitle: {
    ...type.h2,
    marginTop: sp(2),
    marginBottom: sp(3),
  },
  rationaleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2.5),
    padding: sp(4),
  },
  rationaleText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    flex: 1,
  },
})
