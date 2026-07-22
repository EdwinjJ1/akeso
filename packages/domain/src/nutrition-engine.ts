import type {
  DietaryPreference,
  FridgeItem,
  Hydration,
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

/**
 * Fixed planning targets for the demo's generic adult-student flow. Each
 * `basis` states where the number comes from so the UI can be audited; none
 * of them is a personalised NRV, clinical advice or treatment.
 */
const NUTRIENT_TARGETS: Readonly<
  Record<
    NutrientKey,
    { label: string; target: number; unit: string; calculation: string; basis: string }
  >
> = {
  protein: {
    label: 'Protein',
    target: 75,
    unit: 'g',
    calculation: 'Sum of mapped food profiles using an assumed edible serving.',
    basis: 'fixed demo planning baseline, above the NHMRC adult RDI range (46-64 g/day)',
  },
  complex_carbs: {
    label: 'Complex carbs',
    target: 180,
    unit: 'g',
    calculation: 'Starch contribution from mapped foods (AFCD Starch column).',
    basis: 'fixed demo planning baseline; no NRV defines a starch intake',
  },
  fiber: {
    label: 'Fibre',
    target: 30,
    unit: 'g',
    calculation: 'Dietary fibre contribution from mapped foods.',
    basis: 'NHMRC NRV adequate intake for adult men (30 g/day)',
  },
  iron: {
    label: 'Iron',
    target: 12,
    unit: 'mg',
    calculation: 'Iron contribution from mapped foods.',
    basis: 'fixed demo planning baseline between the NHMRC adult RDIs (8 mg men / 18 mg women)',
  },
  vitamin_c: {
    label: 'Vitamin C',
    target: 45,
    unit: 'mg',
    calculation: 'Vitamin C contribution from mapped foods.',
    basis: 'NHMRC NRV adult RDI (45 mg/day)',
  },
  omega3: {
    label: 'Omega-3',
    target: 1.5,
    unit: 'g',
    calculation:
      'Long-chain omega-3 (equated) contribution from mapped foods; plant ALA is not counted.',
    basis: 'fixed demo planning baseline, above the NHMRC adult SDT (0.43-0.61 g/day)',
  },
  hydration: {
    label: 'Water',
    target: 2.5,
    unit: 'L',
    calculation: 'Only logged drinking water is counted; food water is not estimated.',
    basis: 'fixed demo planning baseline within the NHMRC adult fluid AI range (2.1-2.6 L/day)',
  },
}

/**
 * Conservative lower-bound litres for a check-in hydration band. `not_sure`
 * (and an absent check-in) return undefined so callers report "nothing
 * logged" rather than claiming a zero-litre measurement exists.
 */
export function hydrationLitresFromBand(
  hydration: Hydration | undefined
): number | undefined {
  switch (hydration) {
    case 'under_0_5l':
      return 0
    case '0_5_1l':
      return 0.5
    case '1_1_5l':
      return 1
    case '1_5_2l':
      return 1.5
    case 'over_2l':
      return 2
    case 'not_sure':
    case undefined:
      return undefined
  }
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
    profileIds: ['natural-yoghurt', 'oats', 'blueberries'],
    boosts: ['protein', 'complex_carbs', 'fiber'],
    prepMinutes: 5,
    tags: ['from fridge', '5 min'],
    restrictedFor: ['vegan'],
  },
  {
    id: 'salmon-rice-spinach-bowl',
    slot: 'lunch',
    title: 'Salmon, rice & spinach bowl',
    profileIds: ['salmon', 'brown-rice', 'baby-spinach', 'red-capsicum'],
    boosts: ['protein', 'complex_carbs', 'iron', 'omega3', 'vitamin_c'],
    prepMinutes: 20,
    tags: ['balanced lunch'],
    restrictedFor: ['vegetarian', 'vegan'],
  },
  {
    id: 'spinach-egg-capsicum-scramble',
    slot: 'snack',
    title: 'Spinach, egg & capsicum scramble',
    profileIds: ['egg', 'baby-spinach', 'red-capsicum'],
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
  const candidates = FOOD_NUTRIENT_PROFILES.filter((profile) =>
    profile.aliases.includes(normalized)
  )

  if (candidates.length !== 1) return undefined
  const profile = candidates[0]

  // A contradictory manual category makes a name-only match uncertain. Keep
  // it visible in the fridge, but do not assume a nutrient profile for it.
  return profile?.fridgeCategory === item.category ? profile : undefined
}

const safeGrams = (item: NutritionInventoryItem, profile: FoodNutrientProfile) =>
  typeof item.quantityGrams === 'number' &&
  Number.isFinite(item.quantityGrams) &&
  item.quantityGrams > 0
    ? Math.min(item.quantityGrams, 2_000)
    : profile.defaultServingGrams

const safeWaterIntake = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

const noteFor = (key: NutrientKey, current: number) => {
  const definition = NUTRIENT_TARGETS[key]
  const remaining = round(Math.max(0, definition.target - current))
  const coverage = round((current / definition.target) * 100)
  const status = remaining > 0
    ? `${remaining}${definition.unit} remains to reach the planning target (${coverage}% currently covered).`
    : `The mapped current value covers the planning target (${coverage}%).`
  const source = key === 'hydration'
    ? 'Source: explicitly logged drinking water; a check-in hydration band counts as its conservative lower bound.'
    : `Food composition source: ${NUTRITION_DATASET.source} ${NUTRITION_DATASET.version}.`

  return `${status} ${definition.calculation} ${source} Target basis: ${definition.basis}; not a personalised NRV or medical recommendation.`
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
      hydration: safeWaterIntake(input.waterIntakeLitres),
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
        // Totals accumulate at full precision and are rounded once at the
        // end, so per-item display rounding never compounds across a fridge.
        const amount = profile.per100g[key] * scale
        nutrients[key] = round(amount)
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
        note: noteFor(key, round(totals[key])),
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
          allergenTags: [...new Set(available.flatMap((item) => item.allergenTags))],
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
        fridge: input.fridge.map(({ id, name, category, allergenTags }) => ({
          id,
          name,
          category,
          allergenTags,
        })),
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
