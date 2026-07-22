import { describe, expect, it, vi } from 'vitest'

import { createMimoAiServices } from './mimo'
import type { NutritionGenerationInput, VisionConfig } from './types'

const config: VisionConfig = {
  enabled: true,
  provider: 'mimo',
  mimoApiKey: 'test-key',
  mimoModel: 'mimo-test-model',
  geminiApiKey: undefined,
  geminiModel: 'gemini-test-model',
}

const input: NutritionGenerationInput = {
  date: '2026-07-21',
  fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable', allergenTags: [] }],
  energy: null,
  profile: null,
}

const response = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )

const blueprint = (itemId: string) => ({
  date: input.date,
  needs: [],
  meals: [
    {
      slot: 'snack',
      itemIds: [itemId],
      actions: [{ method: 'slice', itemIds: [itemId] }],
      boosts: [],
      prepMinutes: 5,
    },
  ],
})

describe('MiMo grounded nutrition blueprint', () => {
  it('falls back when a blueprint references an unconfirmed item id', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => response(blueprint('ghost')))
    const service = createMimoAiServices(config, fetchMock)

    const plan = await service.generateNutrition(input)

    expect(plan.fridge).toEqual(input.fridge)
    expect(plan.meals).toHaveLength(1)
    expect(plan.meals[0]).toMatchObject({
      id: 'confirmed-fridge-1',
      usesFridgeItemIds: ['tomato'],
    })
    expect(JSON.stringify(plan)).not.toContain('ghost')
  })

  it('renders safe actions using only confirmed inventory names', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => response(blueprint('tomato')))
    const service = createMimoAiServices(config, fetchMock)

    const plan = await service.generateNutrition(input)

    expect(plan.fridge).toEqual(input.fridge)
    expect(plan.meals[0]).toMatchObject({
      title: 'Sliced Tomato',
      description: 'Slice Tomato.',
      usesFridgeItemIds: ['tomato'],
    })
  })
})
