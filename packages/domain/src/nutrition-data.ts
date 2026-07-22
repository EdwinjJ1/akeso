import type { FridgeCategory, NutrientKey } from './types.js'

/**
 * Versioned, intentionally small AFCD-backed demo subset. See
 * docs/NUTRITION_DATA.md for the source workbook, the exact column behind
 * each nutrient key, the alias policy and limitations before adding or
 * updating a food profile.
 */
export const NUTRITION_DATASET = {
  id: 'afcd-r3-demo-subset',
  version: '3.0-demo.2',
  source: 'FSANZ Australian Food Composition Database (AFCD), Release 3',
  released: '2025-12',
  imported: '2026-07-22',
} as const

export type FoodNutrientKey = Exclude<NutrientKey, 'hydration'>

export interface FoodNutrientProfile {
  /** Stable application key, not an AFCD public food key. */
  id: string
  /** AFCD Release 3 Public Food Key of the row this profile was imported from. */
  publicFoodKey: string
  /** Exact AFCD Release 3 Food Name of that row, copied verbatim. */
  afcdFoodName: string
  /**
   * Lower-case names accepted from manual fridge entry. An alias must
   * identify a single AFCD row for a typical fridge item. Generic names
   * whose retail variants differ materially ("rice", "yogurt", "spinach",
   * "capsicum") are deliberately absent: they fall back to unmapped rather
   * than silently becoming one specific food.
   */
  aliases: readonly string[]
  /** Australian Dietary Guidelines five-food-group aligned display group. */
  foodGroup: string
  fridgeCategory: FridgeCategory
  /** Default amount when Issue #21 has not supplied a quantity yet. */
  defaultServingGrams: number
  /**
   * Nutrient contribution per 100g edible portion, copied from the AFCD
   * Release 3 "All solids & liquids per 100 g" worksheet columns listed in
   * docs/NUTRITION_DATA.md. `complex_carbs` is Starch (g); `omega3` is
   * "Total long chain omega 3 fatty acids, equated (mg)" divided by
   * MG_PER_G so the stored unit is grams.
   */
  per100g: Readonly<Record<FoodNutrientKey, number>>
}

const none = 0
const MG_PER_G = 1_000

export const FOOD_NUTRIENT_PROFILES: readonly FoodNutrientProfile[] = [
  {
    id: 'egg',
    publicFoodKey: 'F003729',
    afcdFoodName: 'Egg, chicken, whole, raw',
    aliases: ['egg', 'eggs', 'chicken egg', 'chicken eggs'],
    foodGroup: 'Lean meats, poultry, fish, eggs, tofu, nuts and seeds',
    fridgeCategory: 'protein',
    defaultServingGrams: 100,
    per100g: {
      protein: 12.6,
      complex_carbs: none,
      iron: 1.9,
      vitamin_c: none,
      omega3: 66.814 / MG_PER_G,
      fiber: none,
    },
  },
  {
    id: 'baby-spinach',
    publicFoodKey: 'F008749',
    afcdFoodName: 'Spinach, baby, fresh, raw',
    aliases: ['baby spinach', 'baby spinach leaves'],
    foodGroup: 'Vegetables and legumes/beans',
    fridgeCategory: 'vegetable',
    defaultServingGrams: 75,
    per100g: {
      protein: 2.8,
      complex_carbs: none,
      iron: 1.7,
      vitamin_c: 23,
      omega3: none,
      fiber: 2.5,
    },
  },
  {
    id: 'salmon',
    publicFoodKey: 'F007827',
    afcdFoodName: 'Salmon, Atlantic, fillet, raw',
    aliases: ['salmon fillet', 'atlantic salmon', 'atlantic salmon fillet'],
    foodGroup: 'Lean meats, poultry, fish, eggs, tofu, nuts and seeds',
    fridgeCategory: 'protein',
    defaultServingGrams: 150,
    per100g: {
      protein: 20.5,
      complex_carbs: none,
      iron: 0.31,
      vitamin_c: none,
      omega3: 2192.854 / MG_PER_G,
      fiber: none,
    },
  },
  {
    id: 'natural-yoghurt',
    publicFoodKey: 'F009694',
    afcdFoodName: 'Yoghurt, natural, regular fat (~3%)',
    aliases: ['natural yogurt', 'natural yoghurt', 'plain yogurt', 'plain yoghurt'],
    foodGroup: 'Milk, yoghurt, cheese and/or alternatives',
    fridgeCategory: 'dairy',
    defaultServingGrams: 170,
    per100g: {
      protein: 5.1,
      complex_carbs: 0.1,
      iron: none,
      vitamin_c: none,
      omega3: none,
      fiber: 0.1,
    },
  },
  {
    id: 'oats',
    publicFoodKey: 'F006143',
    afcdFoodName: 'Oats, rolled, uncooked',
    aliases: ['oats', 'rolled oats'],
    foodGroup: 'Grain (cereal) foods, mostly wholegrain and/or high cereal fibre varieties',
    fridgeCategory: 'grain',
    defaultServingGrams: 50,
    per100g: {
      protein: 12.2,
      complex_carbs: 53.5,
      iron: 3.5,
      vitamin_c: none,
      omega3: none,
      fiber: 9.5,
    },
  },
  {
    id: 'blueberries',
    publicFoodKey: 'F001290',
    afcdFoodName: 'Blueberry, raw',
    aliases: ['blueberries', 'blueberry', 'fresh blueberries'],
    foodGroup: 'Fruit',
    fridgeCategory: 'fruit',
    defaultServingGrams: 100,
    per100g: {
      protein: 0.5,
      complex_carbs: 0.4,
      iron: 0.35,
      vitamin_c: 2,
      omega3: none,
      fiber: 3,
    },
  },
  {
    // A fridge item is the cooked leftover; the uncooked grain lives in the
    // pantry, so this profile deliberately imports the boiled AFCD row.
    id: 'brown-rice',
    publicFoodKey: 'F007641',
    afcdFoodName: 'Rice, brown, boiled, no added salt',
    aliases: ['brown rice', 'cooked brown rice'],
    foodGroup: 'Grain (cereal) foods, mostly wholegrain and/or high cereal fibre varieties',
    fridgeCategory: 'grain',
    defaultServingGrams: 150,
    per100g: {
      protein: 4.1,
      complex_carbs: 33.2,
      iron: 0.59,
      vitamin_c: none,
      omega3: none,
      fiber: 1.7,
    },
  },
  {
    id: 'red-capsicum',
    publicFoodKey: 'F002247',
    afcdFoodName: 'Capsicum, red, fresh, raw',
    aliases: ['red capsicum', 'red bell pepper', 'red pepper'],
    foodGroup: 'Vegetables and legumes/beans',
    fridgeCategory: 'vegetable',
    defaultServingGrams: 100,
    per100g: {
      protein: 1.1,
      complex_carbs: none,
      iron: 0.28,
      vitamin_c: 240,
      omega3: none,
      fiber: 1.1,
    },
  },
]
