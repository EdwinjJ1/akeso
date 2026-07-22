import { describe, expect, test } from 'vitest'

import { FOOD_NUTRIENT_PROFILES, NUTRITION_DATASET } from './nutrition-data.js'

const profileById = (id: string) => {
  const profile = FOOD_NUTRIENT_PROFILES.find((candidate) => candidate.id === id)
  if (!profile) throw new Error(`Missing profile: ${id}`)
  return profile
}

/**
 * Regression lock against the official AFCD Release 3 "Nutrient profiles"
 * workbook (sheet "All solids & liquids per 100 g"). If a value here fails,
 * either the dataset drifted from the workbook or the workbook release
 * changed — in both cases NUTRITION_DATASET.version must be bumped alongside
 * a re-verified import (see docs/NUTRITION_DATA.md).
 */
describe('AFCD demo subset integrity', () => {
  test('dataset identifies the exact upstream release', () => {
    expect(NUTRITION_DATASET.id).toBe('afcd-r3-demo-subset')
    expect(NUTRITION_DATASET.version).toBe('3.0-demo.2')
    expect(NUTRITION_DATASET.source).toContain('Release 3')
  })

  test('every profile carries a well-formed, unique AFCD public food key', () => {
    const keys = FOOD_NUTRIENT_PROFILES.map((profile) => profile.publicFoodKey)
    expect(new Set(keys).size).toBe(FOOD_NUTRIENT_PROFILES.length)
    expect(keys.every((key) => /^F\d{6}$/.test(key))).toBe(true)
    expect(
      FOOD_NUTRIENT_PROFILES.every((profile) => profile.afcdFoodName.length > 0)
    ).toBe(true)
  })

  test('profile ids and aliases are unique and normalised', () => {
    const ids = FOOD_NUTRIENT_PROFILES.map((profile) => profile.id)
    expect(new Set(ids).size).toBe(ids.length)

    const aliases = FOOD_NUTRIENT_PROFILES.flatMap((profile) => [...profile.aliases])
    expect(new Set(aliases).size).toBe(aliases.length)
    expect(aliases.every((alias) => alias === alias.trim().toLowerCase())).toBe(true)
  })

  test('ambiguous household names are deliberately not aliases', () => {
    const aliases = new Set(
      FOOD_NUTRIENT_PROFILES.flatMap((profile) => [...profile.aliases])
    )
    for (const ambiguous of ['rice', 'yogurt', 'yoghurt', 'spinach', 'capsicum', 'salmon']) {
      expect(aliases.has(ambiguous)).toBe(false)
    }
  })

  test('all nutrient values are finite and non-negative', () => {
    for (const profile of FOOD_NUTRIENT_PROFILES) {
      for (const value of Object.values(profile.per100g)) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
      }
      expect(profile.defaultServingGrams).toBeGreaterThan(0)
    }
  })

  test('representative values match the official Release 3 rows', () => {
    // Capsicum, red, fresh, raw (F002247)
    const capsicum = profileById('red-capsicum')
    expect(capsicum.publicFoodKey).toBe('F002247')
    expect(capsicum.per100g.vitamin_c).toBe(240)
    expect(capsicum.per100g.protein).toBe(1.1)
    expect(capsicum.per100g.fiber).toBe(1.1)

    // Blueberry, raw (F001290)
    const blueberries = profileById('blueberries')
    expect(blueberries.publicFoodKey).toBe('F001290')
    expect(blueberries.per100g.protein).toBe(0.5)
    expect(blueberries.per100g.fiber).toBe(3)
    expect(blueberries.per100g.vitamin_c).toBe(2)

    // Rice, brown, boiled, no added salt (F007641)
    const rice = profileById('brown-rice')
    expect(rice.publicFoodKey).toBe('F007641')
    expect(rice.per100g.protein).toBe(4.1)
    expect(rice.per100g.complex_carbs).toBe(33.2)
    expect(rice.per100g.iron).toBe(0.59)

    // Egg, chicken, whole, raw (F003729)
    const egg = profileById('egg')
    expect(egg.publicFoodKey).toBe('F003729')
    expect(egg.per100g.protein).toBe(12.6)
    expect(egg.per100g.iron).toBe(1.9)
  })

  test('omega3 stores the long-chain mg column converted to grams', () => {
    const salmon = profileById('salmon')
    expect(salmon.publicFoodKey).toBe('F007827')
    // Workbook value: 2192.854 mg per 100 g.
    expect(salmon.per100g.omega3).toBeCloseTo(2.192854, 6)

    const egg = profileById('egg')
    // Workbook value: 66.814 mg per 100 g.
    expect(egg.per100g.omega3).toBeCloseTo(0.066814, 6)

    // Plant foods report zero long-chain omega-3 in Release 3; ALA is
    // intentionally not counted (see docs/NUTRITION_DATA.md).
    expect(profileById('oats').per100g.omega3).toBe(0)
    expect(profileById('baby-spinach').per100g.omega3).toBe(0)
  })
})
