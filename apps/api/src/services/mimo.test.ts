import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalFetch = global.fetch
const originalKey = process.env.MIMO_API_KEY

const confirmedInventory = [
  { id: 'tomato', name: 'Tomato', category: 'vegetable' as const, allergenTags: [] },
]

const hallucinatedResponsePayload = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          date: '2026-07-21',
          needs: [],
          // The model echoes an ingredient the user never confirmed.
          fridge: [
            { id: 'tomato', name: 'Tomato', category: 'vegetable' },
            { id: 'ghost-ingredient', name: 'Ghost ingredient', category: 'other' },
          ],
          meals: [
            {
              id: 'meal-1',
              slot: 'lunch',
              title: 'Hallucinated meal',
              description: 'Uses an ingredient the user never confirmed.',
              usesFridgeItemIds: ['tomato', 'ghost-ingredient'],
              boosts: [],
              prepMinutes: 10,
              tags: [],
            },
          ],
          rationale: 'Uses your confirmed inventory.',
        }),
      },
    },
  ],
}

describe('generateNutritionWithMiMo confirmed-inventory guard', () => {
  beforeEach(() => {
    process.env.MIMO_API_KEY = 'test-key'
    vi.resetModules()
  })

  afterEach(() => {
    process.env.MIMO_API_KEY = originalKey
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('never trusts the model-echoed fridge array; falls back when a meal references an unconfirmed item', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => hallucinatedResponsePayload,
    })) as unknown as typeof fetch

    const { createAiServices } = await import('./mimo')
    const plan = await createAiServices().generateNutrition({
      date: '2026-07-21',
      fridge: confirmedInventory,
      energy: null,
      profile: null,
    })

    expect(plan.fridge).toEqual(confirmedInventory)
    for (const meal of plan.meals) {
      for (const id of meal.usesFridgeItemIds) {
        expect(id).toBe('tomato')
      }
    }
  })

  it('accepts a plan that only references confirmed inventory ids', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: '2026-07-21',
                needs: [],
                fridge: confirmedInventory,
                meals: [
                  {
                    id: 'meal-1',
                    slot: 'lunch',
                    title: 'Simple tomato snack',
                    description: 'Uses only the confirmed tomato.',
                    usesFridgeItemIds: ['tomato'],
                    boosts: [],
                    prepMinutes: 10,
                    tags: [],
                  },
                ],
                rationale: 'Uses your confirmed inventory.',
              }),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch

    const { createAiServices } = await import('./mimo')
    const plan = await createAiServices().generateNutrition({
      date: '2026-07-21',
      fridge: confirmedInventory,
      energy: null,
      profile: null,
    })

    expect(plan.meals[0].title).toBe('Simple tomato snack')
    expect(plan.fridge).toEqual(confirmedInventory)
  })
})
