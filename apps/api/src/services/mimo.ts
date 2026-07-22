import {
  ingredientRecognitionResultSchema,
  type IngredientRecognitionResult,
  type NutritionPlan,
} from '@akeso/domain'

import { HttpError } from '../http-error'
import {
  fallbackNutrition,
  normalizeRecognitionResult,
  nutritionPrompt,
  parseJson,
  postJsonWithOneRetry,
  recognitionPrompt,
  unavailableError,
  validateNutritionPlanOutput,
} from './shared'
import type {
  AiServices,
  NutritionGenerationInput,
  UploadedImage,
  VisionConfig,
} from './types'

const MIMO_URL = 'https://api.xiaomimimo.com/v1/chat/completions'

function outputText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.choices)) {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  const first = payload.choices[0]
  const message =
    typeof first === 'object' && first !== null && !Array.isArray(first)
      ? (first as Record<string, unknown>).message
      : undefined
  const content =
    typeof message === 'object' && message !== null && !Array.isArray(message)
      ? (message as Record<string, unknown>).content
      : undefined
  if (typeof content !== 'string') {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  return content
}

export function createMimoAiServices(
  config: VisionConfig,
  fetchImpl: typeof fetch
): AiServices {
  const postMiMo = (body: unknown) => {
    if (!config.enabled || !config.mimoApiKey || !config.mimoModel) {
      throw unavailableError()
    }
    return postJsonWithOneRetry(
      MIMO_URL,
      {
        Authorization: `Bearer ${config.mimoApiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      fetchImpl
    )
  }

  const recognizeIngredients = async (
    image: UploadedImage
  ): Promise<IngredientRecognitionResult> => {
    const payload = await postMiMo({
      model: config.mimoModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: recognitionPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.bytes.toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2_048,
      thinking: { type: 'disabled' },
      stream: false,
    })
    const parsed = ingredientRecognitionResultSchema.safeParse(
      normalizeRecognitionResult(parseJson(outputText(payload)))
    )
    if (!parsed.success) {
      throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI output failed validation.')
    }
    return parsed.data
  }

  const generateNutrition = async (
    input: NutritionGenerationInput
  ): Promise<NutritionPlan> => {
    if (input.fridge.length === 0) return fallbackNutrition(input)

    try {
      const payload = await postMiMo({
        model: config.mimoModel,
        messages: [{ role: 'user', content: nutritionPrompt(input) }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 3_000,
        thinking: { type: 'disabled' },
        stream: false,
      })
      const parsed = validateNutritionPlanOutput(
        input,
        parseJson(outputText(payload))
      )
      if (parsed) return parsed
      console.warn('Nutrition AI output failed confirmed-inventory validation.')
    } catch (error) {
      console.warn(
        'Nutrition AI unavailable; using confirmed-inventory fallback:',
        error instanceof Error ? error.name : 'unknown error'
      )
    }

    return fallbackNutrition(input)
  }

  return { recognizeIngredients, generateNutrition }
}
