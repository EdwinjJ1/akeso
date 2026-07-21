import { afterEach, describe, expect, test, vi } from 'vitest'

import { HttpError } from '../http-error'
import {
  createAiServices,
  getSelectedVisionIdentity,
  NUTRITION_PROMPT_VERSION,
} from './ai'
import type { AiServices } from './types'

type TestVisionConfig = {
  enabled: boolean
  provider: string
  mimoApiKey?: string
  mimoModel: string
  geminiApiKey?: string
  geminiModel: string
}

const image = {
  bytes: Buffer.from('image'),
  mimeType: 'image/jpeg' as const,
}

const validRecognition = {
  status: 'ok',
  ingredients: [
    {
      name: 'Tomato',
      category: 'vegetable',
      confidence: 0.94,
      uncertaintyReason: null,
    },
  ],
}

const geminiResponse = (text: string, status = 200) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status, headers: { 'content-type': 'application/json' } }
  )

const mimoResponse = (text: string) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: text } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )

const collectObjectKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectObjectKeys(child),
  ])
}

const createServices = (
  config: TestVisionConfig,
  fetchImpl: typeof fetch
): AiServices =>
  (
    createAiServices as unknown as (
      config: TestVisionConfig,
      fetchImpl: typeof fetch
    ) => AiServices
  )(config, fetchImpl)

const config = (overrides: Partial<TestVisionConfig> = {}): TestVisionConfig => ({
  enabled: true,
  provider: 'gemini',
  mimoApiKey: 'mimo-test-key',
  mimoModel: 'mimo-test-model',
  geminiApiKey: 'gemini-test-key',
  geminiModel: 'gemini-test-model',
  ...overrides,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AI provider selection', () => {
  test('versions the text-free grounded nutrition blueprint contract', () => {
    expect(NUTRITION_PROMPT_VERSION).toBe(3)
  })

  test('identifies the selected Gemini model for cache partitioning', () => {
    expect(getSelectedVisionIdentity(config())).toEqual({
      provider: 'gemini',
      model: 'gemini-test-model',
    })
  })

  test('sends an image only to the explicitly selected Gemini provider', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
      )
      expect(init?.headers).toMatchObject({
        'x-goog-api-key': 'gemini-test-key',
        'Content-Type': 'application/json',
      })
      return geminiResponse(JSON.stringify(validRecognition))
    })

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).resolves.toEqual(validRecognition)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('keeps MiMo selectable without contacting Gemini', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe('https://api.xiaomimimo.com/v1/chat/completions')
      const prompt = JSON.parse(String(init?.body)).messages[0].content[0].text
      expect(prompt).toContain(
        '{"status":"ok","ingredients":[{"name":"tomato","category":"vegetable","confidence":0.95,"uncertaintyReason":null}]}'
      )
      expect(prompt).toContain(
        '{"status":"empty","ingredients":[],"reason":"no_food_detected"}'
      )
      expect(prompt).toContain(
        '{"status":"empty","ingredients":[],"reason":"unrecognizable_image"}'
      )
      expect(prompt).toContain(
        '{"status":"refused","ingredients":[],"reason":"brief policy reason"}'
      )
      return mimoResponse(JSON.stringify(validRecognition))
    })

    await expect(
      createServices(config({ provider: 'mimo' }), fetchMock).recognizeIngredients(image)
    ).resolves.toEqual(validRecognition)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each(['other', 'toString'])(
    'rejects unknown provider %s before making any request',
    async (provider) => {
      const fetchMock = vi.fn<typeof fetch>()

      const promise = createServices(
        config({ provider }),
        fetchMock
      ).recognizeIngredients(image)

      await expect(promise).rejects.toMatchObject({
        status: 503,
        code: 'AI_UNAVAILABLE',
        message: 'Fridge recognition is unavailable; use manual ingredient entry.',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test('requires a provider to be explicitly configured', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    await expect(
      createServices(config({ provider: '' }), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({ status: 503, code: 'AI_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Gemini production provider', () => {
  test('maps inline image input and requests response JSON Schema', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.contents[0]).toMatchObject({
        role: 'user',
        parts: [
          { text: expect.stringContaining('Presence only') },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: image.bytes.toString('base64'),
            },
          },
        ],
      })
      expect(body.generationConfig).toMatchObject({
        responseMimeType: 'application/json',
      })
      expect(body.generationConfig.responseJsonSchema).toEqual({
        oneOf: [
          expect.objectContaining({
            additionalProperties: false,
            required: ['status', 'ingredients'],
            properties: expect.objectContaining({
              status: { type: 'string', enum: ['ok'] },
            }),
          }),
          expect.objectContaining({
            additionalProperties: false,
            required: ['status', 'ingredients', 'reason'],
            properties: expect.objectContaining({
              status: { type: 'string', enum: ['empty'] },
              reason: {
                type: 'string',
                enum: ['no_food_detected', 'unrecognizable_image'],
              },
            }),
          }),
          expect.objectContaining({
            additionalProperties: false,
            required: ['status', 'ingredients', 'reason'],
            properties: expect.objectContaining({
              status: { type: 'string', enum: ['refused'] },
            }),
          }),
        ],
      })
      const schemaKeys = collectObjectKeys(
        body.generationConfig.responseJsonSchema
      )
      expect(schemaKeys).not.toContain('const')
      expect(schemaKeys).not.toContain('minLength')
      expect(schemaKeys).not.toContain('maxLength')
      expect(
        body.generationConfig.responseJsonSchema.oneOf[0].properties
      ).not.toHaveProperty('reason')
      return geminiResponse(JSON.stringify(validRecognition))
    })

    await createServices(config(), fetchMock).recognizeIngredients(image)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('parses text across Gemini candidate parts and validates the shared schema', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: '' },
                  { text: JSON.stringify(validRecognition) },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).resolves.toEqual(validRecognition)
  })

  test.each([429, 503])('retries HTTP %s exactly once', async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('temporary', { status }))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(validRecognition)))

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).resolves.toEqual(validRecognition)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('does not retry a second provider failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('temporary', { status: 503 }))

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({ status: 502, code: 'AI_PROVIDER_ERROR' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('normalizes a final 429 as AI_RATE_LIMITED', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('busy', { status: 429 }))

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({
      status: 503,
      code: 'AI_RATE_LIMITED',
      message: 'AI is busy; keep editing manually and try once more.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('normalizes a non-JSON provider response', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response('not json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each(['mimo', 'gemini'] as const)(
    'rejects HTTP 200 null JSON from %s as malformed output',
    async (provider) => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        new Response('null', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

      await expect(
        createServices(config({ provider }), fetchMock).recognizeIngredients(image)
      ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
    }
  )

  test.each([
    ['mimo', []],
    ['mimo', 'text'],
    ['gemini', []],
    ['gemini', 42],
  ] as const)(
    'rejects HTTP 200 non-object JSON from %s as malformed output',
    async (provider, payload) => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

      await expect(
        createServices(config({ provider }), fetchMock).recognizeIngredients(image)
      ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
    }
  )

  test.each([
    ['mimo', { choices: {} }],
    ['mimo', { choices: [{ message: { content: [] } }] }],
    ['gemini', { candidates: {} }],
    ['gemini', { candidates: [{ content: { parts: {} } }] }],
  ] as const)(
    'rejects malformed %s response envelopes without leaking runtime errors',
    async (provider, payload) => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

      await expect(
        createServices(config({ provider }), fetchMock).recognizeIngredients(image)
      ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
    }
  )

  test('normalizes a 15-second abort as AI_TIMEOUT without retrying', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })

    const promise = createServices(config(), fetchMock).recognizeIngredients(image)
    const assertion = expect(promise).rejects.toMatchObject({
      status: 504,
      code: 'AI_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each(['mimo', 'gemini'] as const)(
    'maps a stalled %s response body abort to AI_TIMEOUT without retrying',
    async (provider) => {
      vi.useFakeTimers()
      const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
        const signal = init?.signal
        const response = new Response(null, { status: 200 })
        Object.defineProperty(response, 'json', {
          value: async () =>
            await new Promise<never>((_resolve, reject) => {
              signal?.addEventListener('abort', () => {
                const error = new Error('body consumption aborted')
                error.name = 'AbortError'
                reject(error)
              })
            }),
        })
        return response
      })

      const promise = createServices(
        config({ provider }),
        fetchMock
      ).recognizeIngredients(image)
      const assertion = expect(promise).rejects.toMatchObject({
        status: 504,
        code: 'AI_TIMEOUT',
      })
      await vi.advanceTimersByTimeAsync(15_000)
      await assertion
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  test('normalizes malformed structured output', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse('{"status":"ok","ingredients":[]}')
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({
      status: 502,
      code: 'MALFORMED_AI_OUTPUT',
      message: 'AI output failed validation.',
    })
  })

  test.each(['mimo', 'gemini'] as const)(
    'normalizes missing empty ingredients from %s before shared validation',
    async (provider) => {
      const output = { status: 'empty', reason: 'no_food_detected' }
      const fetchMock = vi.fn<typeof fetch>(async () =>
        provider === 'mimo'
          ? mimoResponse(JSON.stringify(output))
          : geminiResponse(JSON.stringify(output))
      )

      await expect(
        createServices(config({ provider }), fetchMock).recognizeIngredients(image)
      ).resolves.toEqual({ ...output, ingredients: [] })
    }
  )

  test('normalizes missing refused ingredients without changing a valid reason', async () => {
    const output = { status: 'refused', reason: 'policy restriction' }
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(output))
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).resolves.toEqual({ ...output, ingredients: [] })
  })

  test.each([
    { status: 'ok' },
    { status: 'unknown', reason: 'no_food_detected' },
    { status: 'refused', reason: '' },
    {
      status: 'empty',
      ingredients: validRecognition.ingredients,
      reason: 'no_food_detected',
    },
  ])('does not normalize malformed recognition variants', async (output) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(output))
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
  })

  test.each([
    {
      status: 'ok',
      ingredients: [
        {
          name: '',
          category: 'vegetable',
          confidence: 0.8,
          uncertaintyReason: null,
        },
      ],
    },
    { status: 'refused', ingredients: [], reason: '' },
  ])('keeps strict final Zod validation after Gemini schema relaxation', async (output) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(output))
    )

    await expect(
      createServices(config(), fetchMock).recognizeIngredients(image)
    ).rejects.toMatchObject({ status: 502, code: 'MALFORMED_AI_OUTPUT' })
  })

  test('returns unavailable when Gemini configuration is missing', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    await expect(
      createServices(config({ geminiApiKey: undefined }), fetchMock).recognizeIngredients(
        image
      )
    ).rejects.toBeInstanceOf(HttpError)
    await expect(
      createServices(config({ geminiApiKey: undefined }), fetchMock).recognizeIngredients(
        image
      )
    ).rejects.toMatchObject({ status: 503, code: 'AI_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('generates a structured nutrition plan from confirmed inventory', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: null,
    }
    const blueprint = {
      date: input.date,
      needs: [],
      meals: [
        {
          slot: 'snack',
          itemIds: ['tomato'],
          actions: [{ method: 'slice', itemIds: ['tomato'] }],
          boosts: [],
          prepMinutes: 5,
        },
      ],
    }
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.contents[0].parts[0].text).toContain(JSON.stringify(input))
      expect(body.generationConfig).toMatchObject({
        responseMimeType: 'application/json',
        responseJsonSchema: expect.any(Object),
      })
      const mealSchema =
        body.generationConfig.responseJsonSchema.properties.meals.items
      expect(mealSchema.required).toEqual([
        'slot',
        'itemIds',
        'actions',
        'boosts',
        'prepMinutes',
      ])
      expect(mealSchema.properties.actions.items.properties.method.enum).toEqual([
        'serve',
        'slice',
        'chop',
        'mix',
        'combine',
        'heat',
        'cook',
        'toast',
        'blend',
      ])
      expect(mealSchema.properties).not.toHaveProperty('title')
      expect(mealSchema.properties).not.toHaveProperty('description')
      return geminiResponse(JSON.stringify(blueprint))
    })

    await expect(
      createServices(config(), fetchMock).generateNutrition(input)
    ).resolves.toEqual({
      date: input.date,
      needs: [],
      fridge: input.fridge,
      meals: [
        {
          id: 'meal-1',
          slot: 'snack',
          title: 'Sliced Tomato',
          description: 'Slice Tomato.',
          usesFridgeItemIds: ['tomato'],
          boosts: [],
          prepMinutes: 5,
          tags: ['slice', 'confirmed inventory'],
        },
      ],
      rationale:
        'Recommendations use only confirmed fridge items and reflect today’s moderate energy.',
    })
  })

  test('falls back when Gemini replaces confirmed inventory with invented food', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: null,
    }
    const inventedBlueprint = {
      date: input.date,
      needs: [],
      meals: [
        {
          slot: 'dinner',
          itemIds: ['salmon'],
          actions: [{ method: 'cook', itemIds: ['salmon'] }],
          boosts: ['protein'],
          prepMinutes: 15,
        },
      ],
    }
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(inventedBlueprint))
    )

    const result = await createServices(config(), fetchMock).generateNutrition(input)

    expect(result.fridge).toEqual(input.fridge)
    expect(result.meals.flatMap((meal) => meal.usesFridgeItemIds)).toEqual([
      'tomato',
    ])
  })

  test('grounds every user-visible field when provider prose invents unavailable food', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: {
        displayName: 'Alex',
        goal: 'balance' as const,
        typicalWake: '07:00',
        typicalSleep: '23:00',
        dietaryPreference: 'vegetarian' as const,
      },
    }
    const blueprintWithUntrustedProse = {
      date: input.date,
      needs: ['protein'],
      meals: [
        {
          id: 'salmon-meal',
          slot: 'dinner',
          itemIds: ['tomato'],
          actions: [{ method: 'slice', itemIds: ['tomato'] }],
          boosts: ['protein'],
          prepMinutes: 15,
          // Deliberately outside the private blueprint contract. Even if a
          // provider emits them, these strings must never reach the client.
          title: 'Tomato with salmon',
          description: 'Serve the tomato with salmon.',
          tags: ['salmon dinner'],
        },
      ],
      rationale: 'Salmon makes this vegetarian plan complete.',
    }
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(blueprintWithUntrustedProse))
    )

    const result = await createServices(config(), fetchMock).generateNutrition(input)
    const userVisibleText = JSON.stringify({
      needs: result.needs,
      meals: result.meals,
      rationale: result.rationale,
    }).toLowerCase()

    expect(userVisibleText).not.toContain('salmon')
    expect(userVisibleText).toContain('tomato')
    expect(result.meals[0]).toMatchObject({
      id: 'meal-1',
      slot: 'dinner',
      usesFridgeItemIds: ['tomato'],
      prepMinutes: 15,
    })
  })

  test('conservatively excludes categories incompatible with dietary preference', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [
        { id: 'tomato', name: 'Tomato', category: 'vegetable' as const },
        { id: 'cheese', name: 'Cheese', category: 'dairy' as const },
      ],
      energy: null,
      profile: {
        displayName: 'Alex',
        goal: 'balance' as const,
        typicalWake: '07:00',
        typicalSleep: '23:00',
        dietaryPreference: 'vegan' as const,
      },
    }
    const blueprint = {
      date: input.date,
      needs: [],
      meals: [
        {
          slot: 'lunch',
          itemIds: ['tomato'],
          actions: [{ method: 'serve', itemIds: ['tomato'] }],
          boosts: [],
          prepMinutes: 10,
        },
        {
          slot: 'snack',
          itemIds: ['cheese'],
          actions: [{ method: 'serve', itemIds: ['cheese'] }],
          boosts: ['protein'],
          prepMinutes: 5,
        },
      ],
    }
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(blueprint))
    )

    const result = await createServices(config(), fetchMock).generateNutrition(input)

    expect(result.meals.map((meal) => meal.id)).toEqual(['meal-1'])
    expect(JSON.stringify(result.meals).toLowerCase()).not.toContain('cheese')
  })

  test('renders different grounded advice from different safe action blueprints', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: null,
    }
    const blueprint = (method: 'slice' | 'heat') => ({
      date: input.date,
      needs: [],
      meals: [
        {
          slot: 'snack',
          itemIds: ['tomato'],
          actions: [{ method, itemIds: ['tomato'] }],
          boosts: [],
          prepMinutes: 5,
        },
      ],
    })
    const sliceFetch = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(blueprint('slice')))
    )
    const heatFetch = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(blueprint('heat')))
    )

    const sliced = await createServices(config(), sliceFetch).generateNutrition(input)
    const heated = await createServices(config(), heatFetch).generateNutrition(input)

    expect(sliced.meals[0].description).toBe('Slice Tomato.')
    expect(heated.meals[0].description).toBe('Warm Tomato.')
    expect(heated.meals[0].description).not.toBe(sliced.meals[0].description)
  })

  test('renders grounded MiMo nutrition and falls back on unknown item ids', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: null,
    }
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
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(mimoResponse(JSON.stringify(blueprint('tomato'))))
      .mockResolvedValueOnce(mimoResponse(JSON.stringify(blueprint('salmon'))))
    const services = createServices(config({ provider: 'mimo' }), fetchMock)

    const grounded = await services.generateNutrition(input)
    const fallback = await services.generateNutrition(input)

    expect(grounded.meals[0]).toMatchObject({
      title: 'Sliced Tomato',
      description: 'Slice Tomato.',
      usesFridgeItemIds: ['tomato'],
    })
    expect(fallback.meals[0]).toMatchObject({
      id: 'confirmed-fridge-1',
      usesFridgeItemIds: ['tomato'],
    })
    expect(JSON.stringify(fallback).toLowerCase()).not.toContain('salmon')
  })
})
