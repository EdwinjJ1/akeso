import { expect, test } from 'vitest'

import { filterNutritionPlanForDietarySafety } from './nutrition-safety'
import type { NutritionPlan } from './types'

const nutritionPlan: NutritionPlan = {
  date: '2026-07-21',
  needs: [
    {
      key: 'protein',
      label: 'Protein',
      current: 38,
      target: 90,
      unit: 'g',
      note: 'Supports steady energy through the afternoon.',
    },
  ],
  fridge: [
    { id: 'fridge-1', name: 'Greek yogurt', category: 'dairy', allergenTags: ['milk'] },
    { id: 'fridge-2', name: 'Salmon fillet', category: 'protein', allergenTags: ['fish'] },
    { id: 'fridge-3', name: 'Eggs', category: 'protein', allergenTags: ['eggs'] },
  ],
  meals: [
    {
      id: 'meal-1',
      slot: 'breakfast',
      title: 'Blueberry yogurt oats',
      description: 'Oats + Greek yogurt + blueberries.',
      usesFridgeItemIds: ['fridge-1'],
      allergenTags: ['milk'],
      boosts: ['protein'],
      prepMinutes: 5,
      tags: ['pre-focus', '5 min'],
    },
    {
      id: 'meal-2',
      slot: 'lunch',
      title: 'Salmon rice bowl',
      description: 'Salmon + brown rice + spinach.',
      usesFridgeItemIds: ['fridge-2'],
      allergenTags: ['fish'],
      boosts: ['protein'],
      prepMinutes: 20,
      tags: ['balanced lunch'],
    },
    {
      id: 'meal-3',
      slot: 'snack',
      title: '3pm egg wrap',
      description: 'A simple protein snack.',
      usesFridgeItemIds: ['fridge-3'],
      allergenTags: ['eggs'],
      boosts: ['protein'],
      prepMinutes: 10,
      tags: ['easy snack'],
    },
  ],
  rationale: "Today's meals keep fuel steady.",
}

test('keeps all meals when the user has no dietary safety filters', () => {
  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: [],
    avoidIngredients: [],
  })

  expect(filtered.meals.map((meal) => meal.id)).toEqual(
    nutritionPlan.meals.map((meal) => meal.id)
  )
  expect(filtered.rationale).toBe(nutritionPlan.rationale)
})

test('removes meals tagged with a reported food allergy', () => {
  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: ['milk'],
    avoidIngredients: [],
  })

  expect(filtered.meals.map((meal) => meal.id)).not.toContain('meal-1')
  expect(filtered.meals.every((meal) => !meal.allergenTags.includes('milk'))).toBe(true)
})

test('removes meals matching a free-text avoid ingredient', () => {
  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: [],
    avoidIngredients: ['salmon'],
  })

  expect(filtered.meals.map((meal) => meal.id)).not.toContain('meal-2')
})

test('withholds meal suggestions when an additional safety note cannot be evaluated', () => {
  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: [],
    avoidIngredients: [],
    notes: 'Avoid cross-contamination.',
  })

  expect(filtered.meals).toEqual([])
  expect(filtered.rationale).toContain('additional dietary safety note')
})

test('returns an empty meal list (a valid plan, not an error) when every meal is filtered out', () => {
  const everyAllergen = [
    ...new Set(nutritionPlan.meals.flatMap((meal) => meal.allergenTags)),
  ]

  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: everyAllergen,
    avoidIngredients: [],
  })

  expect(filtered.meals).toEqual([])
  // The rest of the plan stays intact and structurally valid.
  expect(filtered.date).toBe(nutritionPlan.date)
  expect(filtered.needs).toEqual(nutritionPlan.needs)
  expect(filtered.fridge).toEqual(nutritionPlan.fridge)
  expect(filtered.rationale).toContain('filtered out')
})

test('does not mutate the input plan while filtering', () => {
  const snapshot = JSON.parse(JSON.stringify(nutritionPlan))

  const filtered = filterNutritionPlanForDietarySafety(nutritionPlan, {
    allergens: ['milk'],
    avoidIngredients: ['salmon'],
  })

  // The original plan is untouched...
  expect(nutritionPlan).toEqual(snapshot)
  // ...and the result is a fresh array, never an alias of the input.
  expect(filtered.meals).not.toBe(nutritionPlan.meals)
  expect(filtered.meals.length).toBeLessThan(nutritionPlan.meals.length)
})
