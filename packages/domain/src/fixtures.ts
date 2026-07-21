import { FIXTURE_DATE } from '@akeso/contracts'
import type { FridgeItem, NutritionPlan, UserProfile } from './types'

/**
 * Demo fixture data. Entirely fictional (see TEAM_CONTRACT §4.4) — no real
 * health data. The API team seeds the demo database with these same values
 * so the app looks identical before and after integration.
 *
 * The canonical shared fixtures (check-in, energy score 78, tasks, plan,
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
}

export const fixtureFridge: FridgeItem[] = [
  { id: 'fridge-1', name: 'Eggs', category: 'protein' },
  { id: 'fridge-2', name: 'Spinach', category: 'vegetable' },
  { id: 'fridge-3', name: 'Salmon fillet', category: 'protein' },
  { id: 'fridge-4', name: 'Greek yogurt', category: 'dairy' },
  { id: 'fridge-5', name: 'Oats', category: 'grain' },
  { id: 'fridge-6', name: 'Blueberries', category: 'fruit' },
  { id: 'fridge-7', name: 'Brown rice', category: 'grain' },
  { id: 'fridge-8', name: 'Capsicum', category: 'vegetable' },
]

export const fixtureNutritionPlan: NutritionPlan = {
  date: FIXTURE_DATE,
  needs: [
    {
      key: 'protein',
      label: 'Protein',
      current: 38,
      target: 90,
      unit: 'g',
      note: 'Supports steady energy through the afternoon.',
    },
    {
      key: 'iron',
      label: 'Iron',
      current: 6,
      target: 12,
      unit: 'mg',
      note: 'Low iron is a common driver of afternoon dips.',
    },
    {
      key: 'complex_carbs',
      label: 'Complex carbs',
      current: 95,
      target: 180,
      unit: 'g',
      note: 'Slow carbs at lunch flatten the 2–4pm crash.',
    },
    {
      key: 'hydration',
      label: 'Water',
      current: 1.1,
      target: 2.5,
      unit: 'L',
      note: 'Even mild dehydration reads as fatigue.',
    },
  ],
  fridge: fixtureFridge,
  meals: [
    {
      id: 'meal-1',
      slot: 'breakfast',
      title: 'Blueberry yogurt oats',
      description:
        'Oats + Greek yogurt + blueberries. Slow carbs and protein to extend your morning peak.',
      usesFridgeItemIds: ['fridge-4', 'fridge-5', 'fridge-6'],
      boosts: ['protein', 'complex_carbs'],
      prepMinutes: 5,
      tags: ['pre-focus', '5 min'],
    },
    {
      id: 'meal-2',
      slot: 'lunch',
      title: 'Salmon, rice & spinach bowl',
      description:
        'Salmon + brown rice + spinach + capsicum. Iron and omega-3 aimed straight at your 2–4pm dip.',
      usesFridgeItemIds: ['fridge-3', 'fridge-7', 'fridge-2', 'fridge-8'],
      boosts: ['iron', 'omega3', 'protein'],
      prepMinutes: 20,
      tags: ['anti-dip', 'high-iron'],
    },
    {
      id: 'meal-3',
      slot: 'snack',
      title: '3pm spinach & egg wrap',
      description:
        'Instead of the afternoon coffee — protein and iron without the sleep cost.',
      usesFridgeItemIds: ['fridge-1', 'fridge-2'],
      boosts: ['protein', 'iron'],
      prepMinutes: 10,
      tags: ['coffee swap', 'dip window'],
    },
  ],
  rationale:
    'Your check-in shows elevated stress and an afternoon coffee habit. Today’s meals push iron and protein into lunch and replace the 3pm coffee, which is the cheapest way to soften your 2–4pm dip.',
}
