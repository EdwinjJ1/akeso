/**
 * Dietary-safety filtering for meal recommendations.
 *
 * This is a health-safety filter, not a preference nicety: a meal that could
 * expose the user to a reported food allergy MUST be removed. The rules are
 * deliberately conservative and err toward hiding a meal:
 *
 *  - `allergenTags` is the structured, authoritative signal — a meal is blocked
 *    if it carries ANY allergen the user reported (exact tag-set match).
 *  - `avoidIngredients` is a best-effort, free-text guard: a case-insensitive
 *    substring scan over the meal's title, description and tags. It can both
 *    over-match ("egg" also hits "eggplant") and under-match (misspellings), so
 *    it is a convenience layer on top of `allergenTags`, never a substitute.
 *
 * Every function here is pure: it never mutates the input plan, meal or profile,
 * so callers can safely reuse the originals (fixtures are shared across tests).
 * Filtering may legitimately return an EMPTY meal list — that is a valid plan,
 * not an error; the UI owns the "nothing safe to suggest" state.
 */

import type {
  DietarySafetyProfile,
  MealRecommendation,
  NutritionPlan,
} from './types'

export const DEFAULT_DIETARY_SAFETY: DietarySafetyProfile = {
  allergens: [],
  avoidIngredients: [],
}

function normalizeSafety(
  safety: DietarySafetyProfile | null | undefined
): DietarySafetyProfile {
  return {
    allergens: safety?.allergens ?? [],
    avoidIngredients: safety?.avoidIngredients ?? [],
    ...(safety?.notes ? { notes: safety.notes } : {}),
  }
}

function includesAvoidedIngredient(
  meal: MealRecommendation,
  avoidIngredients: readonly string[]
): boolean {
  if (avoidIngredients.length === 0) return false

  const haystack = [
    meal.title,
    meal.description,
    ...meal.tags,
  ].join(' ').toLowerCase()

  return avoidIngredients.some((ingredient) =>
    haystack.includes(ingredient.trim().toLowerCase())
  )
}

export function isMealAllowedByDietarySafety(
  meal: MealRecommendation,
  safety: DietarySafetyProfile | null | undefined
): boolean {
  const normalized = normalizeSafety(safety)
  const blockedAllergens = new Set(normalized.allergens)

  if (meal.allergenTags.some((tag) => blockedAllergens.has(tag))) {
    return false
  }

  return !includesAvoidedIngredient(meal, normalized.avoidIngredients)
}

export function filterNutritionPlanForDietarySafety(
  plan: NutritionPlan,
  safety: DietarySafetyProfile | null | undefined
): NutritionPlan {
  const filteredMeals = plan.meals.filter((meal) =>
    isMealAllowedByDietarySafety(meal, safety)
  )
  const normalized = normalizeSafety(safety)
  const hasSafetyFilters =
    normalized.allergens.length > 0 || normalized.avoidIngredients.length > 0

  return {
    ...plan,
    meals: filteredMeals,
    rationale: hasSafetyFilters
      ? `${plan.rationale} Meals matching your reported allergies or avoid list are filtered out.`
      : plan.rationale,
  }
}
