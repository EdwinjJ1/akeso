import { afterEach, describe, expect, test, vi } from 'vitest'

import { HttpError } from '../http-error'
import { createAiServices, getSelectedVisionIdentity } from './ai'
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
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      expect(url).toBe('https://api.xiaomimimo.com/v1/chat/completions')
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
        responseJsonSchema: expect.any(Object),
      })
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
    const plan = {
      date: input.date,
      needs: [],
      fridge: input.fridge,
      meals: [
        {
          id: 'meal-1',
          slot: 'snack',
          title: 'Sliced tomato',
          description: 'Slice and serve the tomato.',
          usesFridgeItemIds: ['tomato'],
          boosts: [],
          prepMinutes: 5,
          tags: ['low effort'],
        },
      ],
      rationale: 'Uses the only confirmed fridge item.',
    }
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.contents[0].parts[0].text).toContain(JSON.stringify(input))
      expect(body.generationConfig).toMatchObject({
        responseMimeType: 'application/json',
        responseJsonSchema: expect.any(Object),
      })
      return geminiResponse(JSON.stringify(plan))
    })

    await expect(
      createServices(config(), fetchMock).generateNutrition(input)
    ).resolves.toEqual(plan)
  })

  test('falls back when Gemini replaces confirmed inventory with invented food', async () => {
    const input = {
      date: '2026-07-22',
      fridge: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' as const }],
      energy: null,
      profile: null,
    }
    const inventedPlan = {
      date: input.date,
      needs: [],
      fridge: [{ id: 'salmon', name: 'Salmon', category: 'protein' }],
      meals: [
        {
          id: 'meal-1',
          slot: 'dinner',
          title: 'Salmon dinner',
          description: 'Serve salmon.',
          usesFridgeItemIds: ['salmon'],
          boosts: ['protein'],
          prepMinutes: 15,
          tags: ['invented'],
        },
      ],
      rationale: 'Uses invented food.',
    }
    const fetchMock = vi.fn<typeof fetch>(async () =>
      geminiResponse(JSON.stringify(inventedPlan))
    )

    const result = await createServices(config(), fetchMock).generateNutrition(input)

    expect(result.fridge).toEqual(input.fridge)
    expect(result.meals.flatMap((meal) => meal.usesFridgeItemIds)).toEqual([
      'tomato',
    ])
  })
})
