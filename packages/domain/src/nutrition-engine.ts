import type {
  DietaryPreference,
  FridgeItem,
  MealRecommendation,
  NutrientKey,
  NutrientNeed,
  NutritionPlan,
} from './types.js'
import {
  FOOD_NUTRIENT_PROFILES,
  NUTRITION_DATASET,
  type FoodNutrientKey,
  type FoodNutrientProfile,
} from './nutrition-data.js'

const FOOD_NUTRIENT_KEYS: readonly FoodNutrientKey[] = [
  'protein',
  'complex_carbs',
  'fiber',
  'iron',
  'vitamin_c',
  'omega3',
]

const NUTRIENT_TARGETS: Readonly<
  Record<
    NutrientKey,
    { label: string; target: number; unit: string; calculation: string }
  >
> = {
  protein: {
    label: 'Protein',
    target: 75,
    unit: 'g',
    calculation: 'Sum of mapped food profiles using an assumed edible serving.',
  },
  complex_carbs: {
    label: 'Complex carbs',
    target: 180,
    unit: 'g',
    calculation: 'Starchy/wholegrain carbohydrate contribution from mapped foods.',
  },
  fiber: {
    label: 'Fibre',
    target: 30,
    unit: 'g',
    calculation: 'Dietary fibre contribution from mapped foods.',
  },
  iron: {
    label: 'Iron',
    target: 12,
    unit: 'mg',
    calculation: 'Iron contribution from mapped foods.',
  },
  vitamin_c: {
    label: 'Vitamin C',
    target: 45,
    unit: 'mg',
    calculation: 'Vitamin C contribution from mapped foods.',
  },
  omega3: {
    label: 'Omega-3',
    target: 1.5,
    unit: 'g',
    calculation: 'Omega-3 contribution from mapped foods.',
  },
  hydration: {
    label: 'Water',
    target: 2.5,
    unit: 'L',
    calculation: 'Only logged drinking water is counted; food water is not estimated.',
  },
}

export interface NutritionInventoryItem extends FridgeItem {
  /** Optional forward-compatible quantity from Issue #21. */
  quantityGrams?: number
}

export interface NutritionProfileContext {
  dietaryPreference?: DietaryPreference
  /** Optional logged drinking water for today; never inferred from food. */
  waterIntakeLitres?: number
}

export interface NutritionEngineInput extends NutritionProfileContext {
  date: string
  fridge: readonly NutritionInventoryItem[]
}

export interface MatchedFoodContribution {
  fridgeItemId: string
  foodProfileId: string
  foodGroup: string
  assumedGrams: number
  nutrients: Readonly<Partial<Record<FoodNutrientKey, number>>>
}

export interface NutritionAnalysis {
  plan: NutritionPlan
  matchedFoods: readonly MatchedFoodContribution[]
  unmatchedFridgeItemIds: readonly string[]
  dataset: typeof NUTRITION_DATASET
}

interface Recipe {
  id: string
  slot: MealRecommendation['slot']
  title: string
  profileIds: readonly string[]
  boosts: MealRecommendation['boosts']
  prepMinutes: number
  tags: readonly string[]
  restrictedFor?: readonly DietaryPreference[]
}

const RECIPES: readonly Recipe[] = [
  {
    id: 'blueberry-yogurt-oats',
    slot: 'breakfast',
    title: 'Blueberry yogurt oats',
    profileIds: ['greek-yogurt', 'oats', 'blueberries'],
    boosts: ['protein', 'complex_carbs', 'fiber'],
    prepMinutes: 5,
    tags: ['from fridge', '5 min'],
    restrictedFor: ['vegan'],
  },
  {
    id: 'salmon-rice-spinach-bowl',
    slot: 'lunch',
    title: 'Salmon, rice & spinach bowl',
    profileIds: ['salmon', 'brown-rice', 'spinach', 'capsicum'],
    boosts: ['protein', 'complex_carbs', 'iron', 'omega3', 'vitamin_c'],
    prepMinutes: 20,
    tags: ['balanced lunch'],
    restrictedFor: ['vegetarian', 'vegan'],
  },
  {
    id: 'spinach-egg-capsicum-scramble',
    slot: 'snack',
    title: 'Spinach, egg & capsicum scramble',
    profileIds: ['egg', 'spinach', 'capsicum'],
    boosts: ['protein', 'iron', 'vitamin_c'],
    prepMinutes: 10,
    tags: ['easy snack'],
    restrictedFor: ['vegan'],
  },
]

const round = (value: number) => Math.round(value * 10) / 10

const normaliseFoodName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const profileFor = (item: FridgeItem): FoodNutrientProfile | undefined => {
  const normalized = normaliseFoodName(item.name)
  return FOOD_NUTRIENT_PROFILES.find((profile) =>
    profile.aliases.includes(normalized)
  )
}

const safeGrams = (item: NutritionInventoryItem, profile: FoodNutrientProfile) =>
  typeof item.quantityGrams === 'number' &&
  Number.isFinite(item.quantityGrams) &&
  item.quantityGrams > 0
    ? Math.min(item.quantityGrams, 2_000)
    : profile.defaultServingGrams

const noteFor = (key: NutrientKey) => {
  const definition = NUTRIENT_TARGETS[key]
  return `${definition.calculation} Baseline: ${NUTRITION_DATASET.source} ${NUTRITION_DATASET.version}; planning guide only, not medical advice.`
}

/**
 * Pure inventory-to-nutrition matching. It never guesses a nutrient profile:
 * unknown food names remain visible to callers but contribute zero values.
 */
export class NutritionEngine {
  analyse(input: NutritionEngineInput): NutritionAnalysis {
    const totals: Record<NutrientKey, number> = {
      protein: 0,
      complex_carbs: 0,
      fiber: 0,
      iron: 0,
      vitamin_c: 0,
      omega3: 0,
      hydration: Math.max(0, input.waterIntakeLitres ?? 0),
    }
    const matchedFoods: MatchedFoodContribution[] = []
    const unmatchedFridgeItemIds: string[] = []
    const profileToFridge = new Map<string, NutritionInventoryItem>()

    for (const item of input.fridge) {
      const profile = profileFor(item)
      if (!profile) {
        unmatchedFridgeItemIds.push(item.id)
        continue
      }

      const grams = safeGrams(item, profile)
      const scale = grams / 100
      const nutrients: Partial<Record<FoodNutrientKey, number>> = {}
      for (const key of FOOD_NUTRIENT_KEYS) {
        const amount = round(profile.per100g[key] * scale)
        nutrients[key] = amount
        totals[key] += amount
      }
      profileToFridge.set(profile.id, item)
      matchedFoods.push({
        fridgeItemId: item.id,
        foodProfileId: profile.id,
        foodGroup: profile.foodGroup,
        assumedGrams: grams,
        nutrients,
      })
    }

    const needs: NutrientNeed[] = (Object.keys(NUTRIENT_TARGETS) as NutrientKey[]).map(
      (key) => ({
        key,
        label: NUTRIENT_TARGETS[key].label,
        current: round(totals[key]),
        target: NUTRIENT_TARGETS[key].target,
        unit: NUTRIENT_TARGETS[key].unit,
        note: noteFor(key),
      })
    )

    const meals = RECIPES.filter(
      (recipe) => !recipe.restrictedFor?.includes(input.dietaryPreference ?? 'none')
    )
      .map((recipe): MealRecommendation | null => {
        const available = recipe.profileIds
          .map((profileId) => profileToFridge.get(profileId))
          .filter((item): item is NutritionInventoryItem => item !== undefined)
        if (available.length < 2) return null

        const missing = recipe.profileIds.filter(
          (profileId) => !profileToFridge.has(profileId)
        )
        const missingNames = missing
          .map((profileId) =>
            FOOD_NUTRIENT_PROFILES.find((profile) => profile.id === profileId)?.aliases[0]
          )
          .filter((name): name is string => name !== undefined)

        return {
          id: `meal-${recipe.id}`,
          slot: recipe.slot,
          title: recipe.title,
          description:
            missingNames.length === 0
              ? `Uses ${available.map((item) => item.name).join(', ')} from your fridge.`
              : `Uses ${available.map((item) => item.name).join(', ')}. Needs purchase: ${missingNames.join(', ')}.`,
          usesFridgeItemIds: available.map((item) => item.id),
          boosts: [...recipe.boosts],
          prepMinutes: recipe.prepMinutes,
          tags: [
            ...recipe.tags,
            ...(missingNames.length === 0
              ? []
              : [`needs purchase: ${missingNames.join(', ')}`]),
          ],
        }
      })
      .filter((meal): meal is MealRecommendation => meal !== null)

    const unmatchedNote =
      unmatchedFridgeItemIds.length === 0
        ? 'All listed fridge items have a mapped profile.'
        : `${unmatchedFridgeItemIds.length} fridge item${unmatchedFridgeItemIds.length === 1 ? '' : 's'} could not be mapped safely, so no nutrient values were assumed for them.`
    const hydrationNote = input.waterIntakeLitres === undefined
      ? 'Water remains at 0L until a drinking amount is logged.'
      : 'Water reflects only the logged drinking amount.'

    return {
      plan: {
        date: input.date,
        needs,
        fridge: input.fridge.map(({ id, name, category }) => ({ id, name, category })),
        meals,
        rationale: `Inventory analysis uses ${NUTRITION_DATASET.source} ${NUTRITION_DATASET.version} demo mappings. ${unmatchedNote} ${hydrationNote} This is general food-planning information, not medical advice.`,
      },
      matchedFoods,
      unmatchedFridgeItemIds,
      dataset: NUTRITION_DATASET,
    }
  }

  plan(input: NutritionEngineInput): NutritionPlan {
    return this.analyse(input).plan
  }
}
