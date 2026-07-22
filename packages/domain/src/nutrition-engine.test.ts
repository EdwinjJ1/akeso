import { describe, expect, test } from 'vitest'

import { fixtureFridge } from './fixtures.js'
import { hydrationLitresFromBand, NutritionEngine } from './nutrition-engine.js'

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
    // Totals derive from the official AFCD Release 3 per-100g rows pinned in
    // nutrition-data.test.ts, accumulated at full precision then rounded once.
    expect(first.plan.needs.find((need) => need.key === 'protein')?.current).toBe(68)
    expect(first.plan.needs.find((need) => need.key === 'protein')?.note).toContain(
      '7g remains'
    )
    expect(first.plan.needs.find((need) => need.key === 'vitamin_c')?.current).toBe(259.3)
    expect(first.plan.needs.find((need) => need.key === 'fiber')?.current).toBe(13.4)
    expect(first.plan.needs.find((need) => need.key === 'omega3')?.current).toBe(3.4)
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
      fridge: [{ id: 'unknown-1', name: 'Mystery campus snack', category: 'other', allergenTags: [] }],
    })

    expect(result.unmatchedFridgeItemIds).toEqual(['unknown-1'])
    expect(result.matchedFoods).toEqual([])
    expect(result.plan.meals).toEqual([])
    expect(result.plan.needs.every((need) => need.current === 0)).toBe(true)
    expect(result.plan.rationale).toContain('could not be mapped safely')
  })

  test('leaves ambiguous household names unmapped instead of guessing a variety', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [
        { id: 'ambiguous-1', name: 'Rice', category: 'grain', allergenTags: [] },
        { id: 'ambiguous-2', name: 'Yogurt', category: 'dairy', allergenTags: [] },
        { id: 'ambiguous-3', name: 'Spinach', category: 'vegetable', allergenTags: [] },
        { id: 'ambiguous-4', name: 'Capsicum', category: 'vegetable', allergenTags: [] },
      ],
    })

    expect(result.unmatchedFridgeItemIds).toEqual([
      'ambiguous-1',
      'ambiguous-2',
      'ambiguous-3',
      'ambiguous-4',
    ])
    expect(result.matchedFoods).toEqual([])
    expect(result.plan.needs.every((need) => need.key === 'hydration' || need.current === 0)).toBe(
      true
    )
  })

  test('does not trust a name-only match when the confirmed category conflicts', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [{ id: 'uncertain-1', name: 'Salmon fillet', category: 'vegetable', allergenTags: [] }],
    })

    expect(result.unmatchedFridgeItemIds).toEqual(['uncertain-1'])
    expect(result.matchedFoods).toEqual([])
    expect(result.plan.needs.every((need) => need.current === 0)).toBe(true)
  })

  test('uses the documented default serving when a fridge quantity is missing or invalid', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [{ ...fixtureFridge[4], quantityGrams: Number.NaN }],
    })

    expect(result.matchedFoods[0]?.assumedGrams).toBe(50)
    expect(result.plan.needs.find((need) => need.key === 'protein')?.current).toBe(6.1)
  })

  test('uses zero rather than leaking a non-finite hydration value', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: [],
      waterIntakeLitres: Number.NaN,
    })

    expect(result.plan.needs.find((need) => need.key === 'hydration')?.current).toBe(0)
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

  test('a vegan preference removes every animal-product recipe', () => {
    const result = engine.analyse({
      date: '2026-07-21',
      fridge: fixtureFridge,
      dietaryPreference: 'vegan',
    })

    expect(result.plan.meals).toEqual([])
  })
})

describe('hydrationLitresFromBand', () => {
  test('maps each band to its conservative lower bound', () => {
    expect(hydrationLitresFromBand('under_0_5l')).toBe(0)
    expect(hydrationLitresFromBand('0_5_1l')).toBe(0.5)
    expect(hydrationLitresFromBand('1_1_5l')).toBe(1)
    expect(hydrationLitresFromBand('1_5_2l')).toBe(1.5)
    expect(hydrationLitresFromBand('over_2l')).toBe(2)
  })

  test('reports "nothing logged" for not_sure and missing check-ins', () => {
    expect(hydrationLitresFromBand('not_sure')).toBeUndefined()
    expect(hydrationLitresFromBand(undefined)).toBeUndefined()
  })
})
