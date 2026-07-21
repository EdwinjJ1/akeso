import type {
  DietaryPreference,
  EnergyBand,
  FridgeCategory,
  FridgeItem,
  NutrientKey,
  NutrientNeed,
  NutritionPlan,
} from './types'

interface InventoryNutritionFallbackInput {
  date: string
  fridge: FridgeItem[]
  energyBand: EnergyBand
  dietaryPreference: DietaryPreference
  needs: NutrientNeed[]
}

const categoryNutrients: Partial<Record<FridgeCategory, NutrientKey[]>> = {
  protein: ['protein'],
  vegetable: ['fiber', 'vitamin_c'],
  fruit: ['fiber', 'vitamin_c'],
  dairy: ['protein'],
  grain: ['complex_carbs', 'fiber'],
}

const allowedForConservativeFallback = (
  item: FridgeItem,
  preference: DietaryPreference
): boolean => {
  if (preference === 'vegan') {
    return item.category !== 'protein' && item.category !== 'dairy'
  }
  if (preference === 'vegetarian' || preference === 'halal') {
    return item.category !== 'protein'
  }
  if (preference === 'gluten_free') return item.category !== 'grain'
  return true
}

const chunksOfThree = (items: FridgeItem[]): FridgeItem[][] => {
  const chunks: FridgeItem[][] = []
  for (let index = 0; index < items.length; index += 3) {
    chunks.push(items.slice(index, index + 3))
  }
  return chunks
}

export function buildInventoryNutritionFallback({
  date,
  fridge,
  energyBand,
  dietaryPreference,
  needs,
}: InventoryNutritionFallbackInput): NutritionPlan {
  const sortedNeeds = [...needs].sort(
    (left, right) =>
      right.target - right.current - (left.target - left.current)
  )

  if (fridge.length === 0) {
    return {
      date,
      needs: sortedNeeds,
      fridge: [],
      meals: [],
      rationale:
        'Add and confirm fridge ingredients to generate suggestions from food you actually have.',
    }
  }

  const usableItems = fridge.filter((item) =>
    allowedForConservativeFallback(item, dietaryPreference)
  )
  const neededKeys = new Set(sortedNeeds.map((need) => need.key))
  const prepMinutes = energyBand === 'low' ? 10 : 20
  const meals = chunksOfThree(usableItems).map((items, index) => {
    const names = items.map((item) => item.name)
    const allergenTags = [
      ...new Set(items.flatMap((item) => item.allergenTags)),
    ]
    const boosts = [
      ...new Set(
        items.flatMap((item) => categoryNutrients[item.category] ?? [])
      ),
    ].filter((key) => neededKeys.has(key))

    return {
      id: `confirmed-fridge-${index + 1}`,
      slot: energyBand === 'low' ? ('snack' as const) : ('lunch' as const),
      title: names.join(' + '),
      description: `A simple option using only your confirmed ingredients: ${names.join(', ')}.`,
      usesFridgeItemIds: items.map((item) => item.id),
      allergenTags,
      boosts,
      prepMinutes,
      tags: [energyBand === 'low' ? 'low effort' : 'from confirmed fridge'],
    }
  })

  return {
    date,
    needs: sortedNeeds,
    fridge,
    meals,
    rationale:
      meals.length > 0
        ? `Suggestions use only ${fridge.length} confirmed fridge item${fridge.length === 1 ? '' : 's'} and reflect today’s ${energyBand} energy.`
        : `No safe automatic combination matched the ${dietaryPreference} preference. Edit your fridge or try AI generation again.`,
  }
}
