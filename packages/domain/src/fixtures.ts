import { FIXTURE_DATE } from '@akeso/contracts'
import type { FridgeItem, UserProfile } from './types'

/**
 * Demo fixture data. Entirely fictional (see TEAM_CONTRACT §4.4) — no real
 * health data. The API team seeds the demo database with these same values
 * so the app looks identical before and after integration.
 *
 * The canonical shared fixtures (check-in, energy result, tasks, plan,
 * coach) live in `@akeso/contracts` and are re-exported here; only fixtures
 * for domain-specific types are defined locally.
 */

export {
  fixtureCheckIn,
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureEnergyResult,
  fixtureTasks,
} from '@akeso/contracts'

export { FIXTURE_DATE }

export const fixtureProfile: UserProfile = {
  displayName: 'Alex',
  goal: 'academic',
  typicalWake: '07:30',
  typicalSleep: '23:30',
  dietaryPreference: 'none',
  dietarySafety: {
    allergens: [],
    avoidIngredients: [],
  },
}

/**
 * Item names are deliberately specific enough to identify one AFCD food
 * profile each (see nutrition-data.ts alias policy): a generic "Spinach" or
 * "Capsicum" would be rejected as ambiguous by the nutrition engine.
 */
export const fixtureFridge: FridgeItem[] = [
  { id: 'fridge-1', name: 'Eggs', category: 'protein', allergenTags: ['eggs'] },
  { id: 'fridge-2', name: 'Baby spinach', category: 'vegetable', allergenTags: [] },
  { id: 'fridge-3', name: 'Salmon fillet', category: 'protein', allergenTags: ['fish'] },
  { id: 'fridge-4', name: 'Natural yogurt', category: 'dairy', allergenTags: ['milk'] },
  { id: 'fridge-5', name: 'Oats', category: 'grain', allergenTags: ['wheat_gluten'] },
  { id: 'fridge-6', name: 'Blueberries', category: 'fruit', allergenTags: [] },
  { id: 'fridge-7', name: 'Brown rice', category: 'grain', allergenTags: [] },
  { id: 'fridge-8', name: 'Red capsicum', category: 'vegetable', allergenTags: [] },
]

// The previous hand-written fixtureNutritionPlan was removed: nothing
// consumes it, and it carried a second, divergent set of targets and meal
