import { expect, test } from 'vitest'

import { fixtureNutritionPlan } from './fixtures'
import { filterNutritionPlanForDietarySafety } from './nutrition-safety'

test('keeps all meals when the user has no dietary safety filters', () => {
  const filtered = filterNutritionPlanForDietarySafety(fixtureNutritionPlan, {
    allergens: [],
    avoidIngredients: [],
  })

  expect(filtered.meals.map((meal) => meal.id)).toEqual(
    fixtureNutritionPlan.meals.map((meal) => meal.id)
  )
  expect(filtered.rationale).toBe(fixtureNutritionPlan.rationale)
})

test('removes meals tagged with a reported food allergy', () => {
  const filtered = filterNutritionPlanForDietarySafety(fixtureNutritionPlan, {
    allergens: ['milk'],
    avoidIngredients: [],
  })

  expect(filtered.meals.map((meal) => meal.id)).not.toContain('meal-1')
  expect(filtered.meals.every((meal) => !meal.allergenTags.includes('milk'))).toBe(true)
})

test('removes meals matching a free-text avoid ingredient', () => {
  const filtered = filterNutritionPlanForDietarySafety(fixtureNutritionPlan, {
    allergens: [],
    avoidIngredients: ['salmon'],
  })

  expect(filtered.meals.map((meal) => meal.id)).not.toContain('meal-2')
})

test('returns an empty meal list (a valid plan, not an error) when every meal is filtered out', () => {
  const everyAllergen = [
    ...new Set(fixtureNutritionPlan.meals.flatMap((meal) => meal.allergenTags)),
  ]

  const filtered = filterNutritionPlanForDietarySafety(fixtureNutritionPlan, {
    allergens: everyAllergen,
    avoidIngredients: [],
  })

  expect(filtered.meals).toEqual([])
  // The rest of the plan stays intact and structurally valid.
  expect(filtered.date).toBe(fixtureNutritionPlan.date)
  expect(filtered.needs).toEqual(fixtureNutritionPlan.needs)
  expect(filtered.fridge).toEqual(fixtureNutritionPlan.fridge)
  expect(filtered.rationale).toContain('filtered out')
})

test('does not mutate the input plan while filtering', () => {
  const snapshot = JSON.parse(JSON.stringify(fixtureNutritionPlan))

  const filtered = filterNutritionPlanForDietarySafety(fixtureNutritionPlan, {
    allergens: ['milk'],
    avoidIngredients: ['salmon'],
  })

  // The original plan is untouched...
  expect(fixtureNutritionPlan).toEqual(snapshot)
  // ...and the result is a fresh array, never an alias of the input.
  expect(filtered.meals).not.toBe(fixtureNutritionPlan.meals)
  expect(filtered.meals.length).toBeLessThan(fixtureNutritionPlan.meals.length)
})
