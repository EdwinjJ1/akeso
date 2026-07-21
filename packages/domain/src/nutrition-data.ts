import type { FridgeCategory, NutrientKey } from './types.js'

/**
 * Versioned, intentionally small AFCD-backed demo subset. See
 * docs/NUTRITION_DATA.md for the source, import steps, nutrient field mapping,
 * and limitations before adding or updating a food profile.
 */
export const NUTRITION_DATASET = {
  id: 'afcd-r3-demo-subset',
  version: '3.0-demo.1',
  source: 'FSANZ Australian Food Composition Database (AFCD), Release 3',
  released: '2025-12',
  imported: '2026-07-21',
} as const

export type FoodNutrientKey = Exclude<NutrientKey, 'hydration'>

export interface FoodNutrientProfile {
  /** Stable application key, not an AFCD public food key. */
  id: string
  /** Lower-case names accepted from manual fridge entry. */
  aliases: readonly string[]
  /** Australian Dietary Guidelines five-food-group aligned display group. */
  foodGroup: string
  fridgeCategory: FridgeCategory
  /** AFCD Release 3 food description used during the curated import. */
  afcdDescription: string
  /** Default amount when Issue #21 has not supplied a quantity yet. */
  defaultServingGrams: number
  /** Nutrient contribution per 100g edible portion. */
  per100g: Readonly<Record<FoodNutrientKey, number>>
}

const none = 0

/**
 * Nutrient figures are a curated, reproducible demo subset rather than a
 * whole-database mirror. Values are rounded to the precision used in the UI.
 */
export const FOOD_NUTRIENT_PROFILES: readonly FoodNutrientProfile[] = [
  {
    id: 'egg',
    aliases: ['egg', 'eggs', 'chicken egg'],
    foodGroup: 'Lean meats, poultry, fish, eggs, tofu, nuts and seeds',
    fridgeCategory: 'protein',
    afcdDescription: 'Egg, chicken, whole, raw',
    defaultServingGrams: 100,
    per100g: { protein: 12.6, complex_carbs: 0.7, iron: 1.8, vitamin_c: none, omega3: 0.1, fiber: none },
  },
  {
    id: 'spinach',
    aliases: ['spinach', 'baby spinach'],
    foodGroup: 'Vegetables and legumes/beans',
    fridgeCategory: 'vegetable',
    afcdDescription: 'Spinach, English, raw',
    defaultServingGrams: 75,
    per100g: { protein: 2.9, complex_carbs: 0.4, iron: 2.7, vitamin_c: 28, omega3: 0.1, fiber: 2.2 },
  },
  {
    id: 'salmon',
    aliases: ['salmon', 'salmon fillet'],
    foodGroup: 'Lean meats, poultry, fish, eggs, tofu, nuts and seeds',
    fridgeCategory: 'protein',
    afcdDescription: 'Salmon, Atlantic, raw',
    defaultServingGrams: 150,
    per100g: { protein: 20.4, complex_carbs: none, iron: 0.3, vitamin_c: none, omega3: 1.9, fiber: none },
  },
  {
    id: 'greek-yogurt',
    aliases: ['greek yogurt', 'greek yoghurt', 'yogurt', 'yoghurt'],
    foodGroup: 'Milk, yoghurt, cheese and/or alternatives',
    fridgeCategory: 'dairy',
    afcdDescription: 'Yoghurt, Greek style, plain',
    defaultServingGrams: 170,
    per100g: { protein: 9, complex_carbs: none, iron: 0.1, vitamin_c: none, omega3: 0.05, fiber: none },
  },
  {
    id: 'oats',
    aliases: ['oats', 'rolled oats', 'oatmeal'],
    foodGroup: 'Grain (cereal) foods, mostly wholegrain and/or high cereal fibre varieties',
    fridgeCategory: 'grain',
    afcdDescription: 'Oats, rolled, dry',
    defaultServingGrams: 50,
    per100g: { protein: 13.2, complex_carbs: 54, iron: 4.5, vitamin_c: none, omega3: 0.2, fiber: 10.1 },
  },
  {
    id: 'blueberries',
    aliases: ['blueberries', 'blueberry'],
    foodGroup: 'Fruit',
    fridgeCategory: 'fruit',
    afcdDescription: 'Blueberries, raw',
    defaultServingGrams: 100,
    per100g: { protein: 0.7, complex_carbs: none, iron: 0.3, vitamin_c: 9.7, omega3: none, fiber: 2.4 },
  },
  {
    id: 'brown-rice',
    aliases: ['brown rice', 'rice'],
    foodGroup: 'Grain (cereal) foods, mostly wholegrain and/or high cereal fibre varieties',
    fridgeCategory: 'grain',
    afcdDescription: 'Rice, brown, cooked',
    defaultServingGrams: 150,
    per100g: { protein: 2.6, complex_carbs: 22.9, iron: 0.2, vitamin_c: none, omega3: none, fiber: 1.6 },
  },
  {
    id: 'capsicum',
    aliases: ['capsicum', 'red capsicum', 'bell pepper', 'red pepper'],
    foodGroup: 'Vegetables and legumes/beans',
    fridgeCategory: 'vegetable',
    afcdDescription: 'Capsicum, red, fresh, raw',
    defaultServingGrams: 100,
    per100g: { protein: 1, complex_carbs: 2.5, iron: 0.4, vitamin_c: 128, omega3: 0.1, fiber: 2.1 },
  },
]
