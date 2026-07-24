import type {
  DietaryPreference,
  FoodAllergen,
  UserGoal,
} from '@akeso/domain'

/**
 * Shared option lists for every screen that edits the UserProfile —
 * onboarding (welcome.tsx) and the personal-info editor. One source keeps
 * the two forms from drifting apart.
 */
export const GOAL_OPTIONS: { value: UserGoal; label: string }[] = [
  { value: 'academic', label: 'Study & exams' },
  { value: 'work', label: 'Work & career' },
  { value: 'fitness', label: 'Training & fitness' },
  { value: 'balance', label: 'Overall balance' },
]

export const WAKE_OPTIONS = ['06:00', '06:30', '07:00', '07:30', '08:00', '09:00']
export const SLEEP_OPTIONS = ['22:00', '22:30', '23:00', '23:30', '00:00', '01:00']

export const DIET_OPTIONS: { value: DietaryPreference; label: string }[] = [
  { value: 'none', label: 'No preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal' },
  { value: 'gluten_free', label: 'Gluten-free' },
]

export const ALLERGEN_OPTIONS: { value: FoodAllergen; label: string }[] = [
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'tree_nuts', label: 'Tree nuts' },
  { value: 'milk', label: 'Milk' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'soy', label: 'Soy' },
  { value: 'wheat_gluten', label: 'Wheat / gluten' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' },
]

export const goalLabel = (goal: UserGoal): string =>
  GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? goal

export const dietLabel = (diet: DietaryPreference): string =>
  DIET_OPTIONS.find((option) => option.value === diet)?.label ?? diet

export const allergenLabel = (allergen: FoodAllergen): string =>
  ALLERGEN_OPTIONS.find((option) => option.value === allergen)?.label ?? allergen

/** Comma/newline separated free text → deduped, trimmed, bounded list. */
export function listFromText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,\n]/)
        .map((value) => value.trim().slice(0, 80))
        .filter(Boolean)
    )
  ).slice(0, 20)
}
