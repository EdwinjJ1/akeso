import { NutritionPlanSchema } from '@akeso/contracts'
import { describe, expect, it } from 'vitest'

import { buildInventoryNutritionFallback } from './nutrition'

const needs = [
  {
    key: 'protein' as const,
    label: 'Protein focus',
    current: 0,
    target: 1,
    unit: 'priority',
  },
  {
    key: 'fiber' as const,
    label: 'Fiber focus',
    current: 0.75,
    target: 1,
    unit: 'priority',
  },
]

describe('inventory nutrition fallback', () => {
  it('returns no meals and asks for manual inventory when the fridge is empty', () => {
    const plan = buildInventoryNutritionFallback({
      date: '2026-07-21',
      fridge: [],
      energyBand: 'low',
      dietaryPreference: 'none',
      needs,
    })

    expect(plan.fridge).toEqual([])
    expect(plan.meals).toEqual([])
    expect(plan.rationale).toMatch(/add.*fridge/i)
    expect(NutritionPlanSchema.safeParse(plan).success).toBe(true)
  })

  it('uses only confirmed inventory ids and caps low-energy prep at 15 minutes', () => {
    const plan = buildInventoryNutritionFallback({
      date: '2026-07-21',
      fridge: [
        { id: 'egg', name: 'Egg', category: 'protein', allergenTags: ['eggs'] },
        { id: 'tomato', name: 'Tomato', category: 'vegetable', allergenTags: [] },
        { id: 'rice', name: 'Brown rice', category: 'grain', allergenTags: [] },
      ],
      energyBand: 'low',
      dietaryPreference: 'none',
      needs,
    })

    const confirmedIds = new Set(plan.fridge.map((item) => item.id))
    expect(plan.meals.length).toBeGreaterThan(0)
    for (const meal of plan.meals) {
      expect(meal.prepMinutes).toBeLessThanOrEqual(15)
      expect(meal.usesFridgeItemIds.every((id) => confirmedIds.has(id))).toBe(true)
    }
    expect(plan.meals[0].allergenTags).toEqual(['eggs'])
    expect(NutritionPlanSchema.safeParse(plan).success).toBe(true)
  })

  it('sorts nutrition priorities by target minus current', () => {
    const plan = buildInventoryNutritionFallback({
      date: '2026-07-21',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable', allergenTags: [] }],
      energyBand: 'moderate',
      dietaryPreference: 'none',
      needs: [needs[1], needs[0]],
    })

    expect(plan.needs.map((need) => need.key)).toEqual(['protein', 'fiber'])
  })
})
