export type VisionProviderName = 'mimo' | 'openai' | 'gemini' | 'minimax'

export interface EncodedImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}

export interface VisionProviderCapability {
  provider: VisionProviderName
  model: string
  supportsImageInput: boolean
  supportsStructuredOutput: boolean
  officialDocumentation: string
  note: string
}

export interface VisionProviderResponse {
  provider: VisionProviderName
  model: string
  rawOutput: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export type EvaluationEnvironment = Record<string, string | undefined>

export class UnsupportedVisionProviderError extends Error {
  constructor(public readonly capability: VisionProviderCapability) {
    super(`${capability.model} does not support image input`)
    this.name = 'UnsupportedVisionProviderError'
  }
}

class ProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ProviderHttpError'
  }
}

const CATEGORIES = ['protein', 'vegetable', 'fruit', 'dairy', 'grain', 'other']

export const INGREDIENT_RECOGNITION_JSON_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'ingredients'],
      properties: {
        status: { const: 'ok' },
        ingredients: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'category', 'confidence', 'uncertaintyReason'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              category: { type: 'string', enum: CATEGORIES },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              uncertaintyReason: {
                anyOf: [
                  { type: 'string', minLength: 1, maxLength: 280 },
                  { type: 'null' },
                ],
              },
            },
          },
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'ingredients', 'reason'],
      properties: {
        status: { const: 'empty' },
        ingredients: { type: 'array', maxItems: 0 },
        reason: {
          type: 'string',
          enum: ['no_food_detected', 'unrecognizable_image'],
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'ingredients', 'reason'],
      properties: {
        status: { const: 'refused' },
        ingredients: { type: 'array', maxItems: 0 },
        reason: { type: 'string', minLength: 1, maxLength: 280 },
      },
    },
  ],
} as const

const RECOGNITION_PROMPT = `Identify only food ingredients visibly present in this image.

Rules:
- Presence only: never output quantities, units, weights, grams, expiry dates, or inferred hidden contents.
- Deduplicate repeated containers into one ingredient.
- Use concise English ingredient names and exactly one allowed category.
- Set uncertaintyReason to null when confident; otherwise explain the visual ambiguity briefly.
- Include only a concrete edible ingredient identified from visible appearance or a readable label.
- Omit containers and unidentified contents. Never emit generic placeholders such as "canned food", "packaged food", "preserved food", "dark liquid", or "unknown beverage".
- If uncertaintyReason would say the specific contents are not identifiable, omit that candidate entirely.
- If there is no visible food ingredient, return status "empty" with reason "no_food_detected".
- If the image is too unclear to identify food safely, return status "empty" with reason "unrecognizable_image".
- If policy prevents processing, return status "refused" and no ingredients.
- Do not infer what may be inside a closed refrigerator or opaque unlabelled container.
- Return exactly one JSON object and no markdown or surrounding prose.

The output must match exactly one of these shapes. Never invent another status:
{"status":"ok","ingredients":[{"name":"tomato","category":"vegetable","confidence":0.95,"uncertaintyReason":null}]}
{"status":"empty","ingredients":[],"reason":"no_food_detected"}
{"status":"empty","ingredients":[],"reason":"unrecognizable_image"}
{"status":"refused","ingredients":[],"reason":"brief policy reason"}

For status "ok", every ingredient must include exactly name, category,
confidence, and uncertaintyReason. Allowed categories are protein, vegetable,
fruit, dairy, grain, and other.`

const capabilities: Record<VisionProviderName, VisionProviderCapability> = {
  mimo: {
    provider: 'mimo',
    model: 'mimo-v2.5',
    supportsImageInput: true,
    supportsStructuredOutput: true,
    officialDocumentation:
      'https://mimo.mi.com/docs/zh-CN/api/chat/openai-api',
    note: 'Native omni-modal image input through the domestic OpenAI-compatible endpoint. The API documents JSON object mode, not strict JSON Schema; every response is revalidated with the shared Zod contract.',
  },
  openai: {
    provider: 'openai',
    model: 'gpt-5.6-luna',
    supportsImageInput: true,
    supportsStructuredOutput: true,
    officialDocumentation: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    note: 'Responses API image input and strict JSON Schema output.',
  },
  gemini: {
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    supportsImageInput: true,
    supportsStructuredOutput: true,
    officialDocumentation:
      'https://ai.google.dev/gemini-api/docs/models',
    note: 'Multimodal input with application/json structured output.',
  },
  minimax: {
    provider: 'minimax',
    model: 'MiniMax-M2.7',
    supportsImageInput: false,
    supportsStructuredOutput: false,
    officialDocumentation: 'https://platform.minimaxi.com/docs/api-reference/text-ai-sdk',
    note: 'The domestic AI SDK compatibility table explicitly marks image input unsupported. Keep M2.7 for text-only nutrition generation, not fridge recognition.',
  },
}

export function getVisionProviderCapability(
  provider: VisionProviderName
): VisionProviderCapability {
  return capabilities[provider]
}

const retryableStatus = (status: number): boolean =>
  status === 429 || (status >= 500 && status <= 599)

async function postJsonWithOneRetry(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetchImpl: typeof fetch
): Promise<{ payload: Record<string, unknown>; latencyMs: number }> {
  const startedAt = performance.now()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (response.ok) {
        let payload: Record<string, unknown>
        try {
          payload = (await response.json()) as Record<string, unknown>
        } catch {
          throw new Error('provider returned a malformed JSON response')
        }
        return { payload, latencyMs: performance.now() - startedAt }
      }
      if (attempt === 0 && retryableStatus(response.status)) continue
      throw new ProviderHttpError(
        response.status,
        `provider request failed with HTTP ${response.status}`
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error('provider retry loop ended unexpectedly')
}

const requireEnvironmentValue = (
  environment: EvaluationEnvironment,
  key: string
): string => {
  const value = environment[key]
  if (!value) throw new Error(`${key} is required for this evaluation provider`)
  return value
}

const findOpenAiOutputText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) throw new Error('OpenAI response has no output')

  for (const item of payload.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const candidate = part as { type?: unknown; text?: unknown }
      if (candidate.type === 'output_text' && typeof candidate.text === 'string') {
        return candidate.text
      }
    }
  }

  throw new Error('OpenAI response has no output text')
}

const findGeminiOutputText = (payload: Record<string, unknown>): string => {
  const candidates = payload.candidates
  if (!Array.isArray(candidates)) throw new Error('Gemini response has no candidates')
  const first = candidates[0] as
    | { content?: { parts?: Array<{ text?: unknown }> } }
    | undefined
  const text = first?.content?.parts?.find((part) => typeof part.text === 'string')
    ?.text
  if (typeof text !== 'string') throw new Error('Gemini response has no output text')
  return text
}

const findOpenAiCompatibleOutputText = (
  provider: string,
  payload: Record<string, unknown>
): string => {
  const choices = payload.choices
  if (!Array.isArray(choices)) throw new Error(`${provider} response has no choices`)
  const first = choices[0] as { message?: { content?: unknown } } | undefined
  const content = first?.message?.content
  if (typeof content !== 'string') {
    throw new Error(`${provider} response has no output text`)
  }
  return content
}

async function callMiMo(
  image: EncodedImage,
  environment: EvaluationEnvironment,
  fetchImpl: typeof fetch
): Promise<VisionProviderResponse> {
  const apiKey = requireEnvironmentValue(environment, 'MIMO_API_KEY')
  const model = environment.MIMO_VISION_MODEL ?? capabilities.mimo.model
  const { payload, latencyMs } = await postJsonWithOneRetry(
    'https://api.xiaomimimo.com/v1/chat/completions',
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECOGNITION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2_048,
      thinking: { type: 'disabled' },
      stream: false,
    },
    fetchImpl
  )
  const usage = (payload.usage ?? {}) as {
    prompt_tokens?: number
    completion_tokens?: number
  }
  const inputTokens = usage.prompt_tokens ?? 0
  const outputTokens = usage.completion_tokens ?? 0
  const inputRate = Number(environment.MIMO_INPUT_USD_PER_MTOK ?? 0.14)
  const outputRate = Number(environment.MIMO_OUTPUT_USD_PER_MTOK ?? 0.28)

  return {
    provider: 'mimo',
    model,
    rawOutput: findOpenAiCompatibleOutputText('MiMo', payload),
    latencyMs,
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000,
  }
}

async function callOpenAi(
  image: EncodedImage,
  environment: EvaluationEnvironment,
  fetchImpl: typeof fetch
): Promise<VisionProviderResponse> {
  const apiKey = requireEnvironmentValue(environment, 'OPENAI_API_KEY')
  const model = environment.OPENAI_VISION_MODEL ?? capabilities.openai.model
  const { payload, latencyMs } = await postJsonWithOneRetry(
    'https://api.openai.com/v1/responses',
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    {
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: RECOGNITION_PROMPT },
            {
              type: 'input_image',
              image_url: `data:${image.mimeType};base64,${image.base64}`,
              detail: 'low',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ingredient_recognition_result',
          strict: true,
          schema: INGREDIENT_RECOGNITION_JSON_SCHEMA,
        },
      },
    },
    fetchImpl
  )
  const usage = (payload.usage ?? {}) as {
    input_tokens?: number
    output_tokens?: number
  }
  const inputTokens = usage.input_tokens ?? 0
  const outputTokens = usage.output_tokens ?? 0
  const inputRate = Number(environment.OPENAI_INPUT_USD_PER_MTOK ?? 1)
  const outputRate = Number(environment.OPENAI_OUTPUT_USD_PER_MTOK ?? 6)

  return {
    provider: 'openai',
    model,
    rawOutput: findOpenAiOutputText(payload),
    latencyMs,
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000,
  }
}

async function callGemini(
  image: EncodedImage,
  environment: EvaluationEnvironment,
  fetchImpl: typeof fetch
): Promise<VisionProviderResponse> {
  const apiKey = requireEnvironmentValue(environment, 'GEMINI_API_KEY')
  const model = environment.GEMINI_VISION_MODEL ?? capabilities.gemini.model
  const { payload, latencyMs } = await postJsonWithOneRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: RECOGNITION_PROMPT },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: INGREDIENT_RECOGNITION_JSON_SCHEMA,
        temperature: 0,
      },
    },
    fetchImpl
  )
  const usage = (payload.usageMetadata ?? {}) as {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
  const inputTokens = usage.promptTokenCount ?? 0
  const outputTokens = usage.candidatesTokenCount ?? 0
  const inputRate = Number(environment.GEMINI_INPUT_USD_PER_MTOK ?? 0.25)
  const outputRate = Number(environment.GEMINI_OUTPUT_USD_PER_MTOK ?? 1.5)

  return {
    provider: 'gemini',
    model,
    rawOutput: findGeminiOutputText(payload),
    latencyMs,
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000,
  }
}

export async function callVisionProvider(
  provider: VisionProviderName,
  image: EncodedImage,
  environment: EvaluationEnvironment,
  fetchImpl: typeof fetch = fetch
): Promise<VisionProviderResponse> {
  const capability = capabilities[provider]
  if (!capability.supportsImageInput) {
    throw new UnsupportedVisionProviderError(capability)
  }
  if (provider === 'mimo') return callMiMo(image, environment, fetchImpl)
  if (provider === 'openai') return callOpenAi(image, environment, fetchImpl)
  return callGemini(image, environment, fetchImpl)
}
