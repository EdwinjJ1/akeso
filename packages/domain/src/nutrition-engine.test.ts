import { describe, expect, test } from 'vitest'

import { fixtureFridge } from './fixtures.js'
import { NutritionEngine } from './nutrition-engine.js'

const engine = new NutritionEngine()

describe('NutritionEngine', () => {
  test('is reproducible for the fixed fridge fixture and explains every need', () => {
    const input = {
      date: '2026-07-21',
      fridge: fixtureFridge,
      waterIntakeLitres: 1.2,
    }
    const first = engine.analyse(input)
    const second = engine.analyse(input)

    expect(first).toEqual(second)
    expect(first.plan.needs).toHaveLength(7)
    expect(first.plan.needs.every((need) => need.unit && need.target > 0 && need.note)).toBe(true)
    expect(first.plan.needs.find((need) => need.key === 'protein')?.current).toBe(72.9)
    expect(first.plan.needs.find((need) => need.key === 'vitamin_c')?.current).toBe(158.7)
    expect(first.plan.needs.find((need) => need.key === 'hydration')?.current).toBe(1.2)
    expect(first.unmatchedFridgeItemIds).toEqual([])
  })

  test('maps confirmed fridge items to food groups and only references available IDs', () => {
    const result = engine.analyse({ date: '2026-07-21', fridge: fixtureFridge })
    const fridgeIds = new Set(fixtureFridge.map((item) => item.id))

    expect(result.matchedFoods).toHaveLength(fixtureFridge.length)
    expect(result.matchedFoods.every((food) => food.foodGroup.length > 0)).toBe(true)
    expect(result.plan.meals.length).toBeGreaterThan(0)
    expect(
      result.plan.meals.every((meal) =>
        meal.usesFridgeItemIds.every((id) => fridgeIds.has(id))
      )
    ).toBe(true)
  })

  test('marks a required purchase instead of claiming a missing food is in stock', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [fixtureFridge[4], fixtureFridge[5]],
    })
    const breakfast = result.plan.meals.find((meal) => meal.slot === 'breakfast')

    expect(breakfast?.usesFridgeItemIds).toEqual(['fridge-5', 'fridge-6'])
    expect(breakfast?.tags.some((tag) => tag.startsWith('needs purchase:'))).toBe(true)
    expect(breakfast?.description).toContain('Needs purchase:')
  })

  test('uses a safe zero-contribution fallback for unknown food names', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [{ id: 'unknown-1', name: 'Mystery campus snack', category: 'other' }],
    })

    expect(result.unmatchedFridgeItemIds).toEqual(['unknown-1'])
    expect(result.matchedFoods).toEqual([])
    expect(result.plan.meals).toEqual([])
    expect(result.plan.needs.every((need) => need.current === 0)).toBe(true)
    expect(result.plan.rationale).toContain('could not be mapped safely')
  })

  test('uses the documented default serving when a fridge quantity is missing or invalid', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [{ ...fixtureFridge[4], quantityGrams: Number.NaN }],
    })

    expect(result.matchedFoods[0]?.assumedGrams).toBe(50)
    expect(result.plan.needs.find((need) => need.key === 'protein')?.current).toBe(6.6)
  })

  test('respects dietary preferences while keeping the personalization input optional', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: fixtureFridge,
      dietaryPreference: 'vegetarian',
    })

    expect(result.plan.meals.some((meal) => meal.id === 'meal-salmon-rice-spinach-bowl')).toBe(false)
    expect(result.plan.meals.length).toBeGreaterThan(0)
  })
})
