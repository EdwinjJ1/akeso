import { describe, expect, it, vi } from 'vitest'
import {
  callVisionProvider,
  getVisionProviderCapability,
  UnsupportedVisionProviderError,
} from './providers'

const image = {
  mimeType: 'image/jpeg',
  base64: 'aW1hZ2U=',
} as const

const collectObjectKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectObjectKeys(child),
  ])
}

describe('vision spike providers', () => {
  it('uses the production Gemini 3.5 Flash-Lite model by default', () => {
    expect(getVisionProviderCapability('gemini').model).toBe(
      'gemini-3.5-flash-lite'
    )
  })

  it('maps MiMo V2.5 image input using the domestic OpenAI-compatible API', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe('https://api.xiaomimimo.com/v1/chat/completions')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      })

      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe('mimo-v2.5-test')
      expect(body.messages[0].content[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,aW1hZ2U=' },
      })
      expect(body.response_format).toEqual({ type: 'json_object' })
      expect(body).not.toHaveProperty('json_schema')
      expect(body.thinking).toEqual({ type: 'disabled' })

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"status":"empty","ingredients":[],"reason":"no_food_detected"}',
              },
            },
          ],
          usage: { prompt_tokens: 120, completion_tokens: 30 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const response = await callVisionProvider(
      'mimo',
      image,
      {
        MIMO_API_KEY: 'test-key',
        MIMO_VISION_MODEL: 'mimo-v2.5-test',
      },
      fetchMock
    )

    expect(response).toMatchObject({
      provider: 'mimo',
      model: 'mimo-v2.5-test',
      inputTokens: 120,
      outputTokens: 30,
    })
    expect(response.costUsd).toBeCloseTo(0.0000252)
  })

  it('blocks MiniMax M2.7 before any image or key can be sent', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    expect(getVisionProviderCapability('minimax')).toMatchObject({
      model: 'MiniMax-M2.7',
      supportsImageInput: false,
    })
    await expect(
      callVisionProvider('minimax', image, { MINIMAX_API_KEY: 'unused' }, fetchMock)
    ).rejects.toBeInstanceOf(UnsupportedVisionProviderError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps OpenAI image input and extracts structured output and usage', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe('gpt-5.6-luna-test')
      expect(body.input[0].content[1]).toMatchObject({
        type: 'input_image',
        image_url: 'data:image/jpeg;base64,aW1hZ2U=',
      })
      expect(body.text.format.type).toBe('json_schema')

      return new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: '{"status":"empty","ingredients":[],"reason":"no_food_detected"}',
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const response = await callVisionProvider(
      'openai',
      image,
      {
        OPENAI_API_KEY: 'test-key',
        OPENAI_VISION_MODEL: 'gpt-5.6-luna-test',
      },
      fetchMock
    )

    expect(response).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.6-luna-test',
      inputTokens: 100,
      outputTokens: 20,
      costUsd: 0.00022,
    })
    expect(JSON.parse(response.rawOutput).status).toBe('empty')
  })

  it('retries one non-JSON 5xx response exactly once', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('temporary upstream failure', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text:
              '{"status":"empty","ingredients":[],"reason":"no_food_detected"}',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

    await expect(
      callVisionProvider('openai', image, { OPENAI_API_KEY: 'test-key' }, fetchMock)
    ).resolves.toMatchObject({ provider: 'openai' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps Gemini inline image input and extracts structured output and usage', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.contents[0].parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: 'aW1hZ2U=',
      })
      expect(body.generationConfig.responseMimeType).toBe('application/json')
      const schema = body.generationConfig.responseJsonSchema
      const statusSchemas = schema.oneOf.map(
        (variant: { properties: { status: unknown } }) =>
          variant.properties.status
      )
      expect(statusSchemas).toEqual([
        { type: 'string', enum: ['ok'] },
        { type: 'string', enum: ['empty'] },
        { type: 'string', enum: ['refused'] },
      ])
      const schemaKeys = collectObjectKeys(schema)
      expect(schemaKeys).not.toContain('const')
      expect(schemaKeys).not.toContain('minLength')
      expect(schemaKeys).not.toContain('maxLength')

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"status":"empty","ingredients":[],"reason":"no_food_detected"}',
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 10 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const response = await callVisionProvider(
      'gemini',
      image,
      {
        GEMINI_API_KEY: 'test-key',
        GEMINI_VISION_MODEL: 'gemini-test',
      },
      fetchMock
    )

    expect(response).toMatchObject({
      provider: 'gemini',
      model: 'gemini-test',
      inputTokens: 80,
      outputTokens: 10,
      costUsd: 0.000035,
    })
  })
})
