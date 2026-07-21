import {
  ingredientRecognitionResultSchema,
  type IngredientRecognitionResult,
  type NutritionPlan,
} from '@akeso/domain'

import { HttpError } from '../http-error'
import {
  fallbackNutrition,
  ingredientRecognitionJsonSchema,
  normalizeRecognitionResult,
  nutritionBlueprintJsonSchema,
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

function outputText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates
  const first = Array.isArray(candidates)
    ? (candidates[0] as
        | { content?: { parts?: Array<{ text?: unknown }> } }
        | undefined)
    : undefined
  const text = first?.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
  if (!text) {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  return text
}

export function createGeminiAiServices(
  config: VisionConfig,
  fetchImpl: typeof fetch
): AiServices {
  const postGemini = (body: unknown) => {
    if (!config.enabled || !config.geminiApiKey || !config.geminiModel) {
      throw unavailableError()
    }
    return postJsonWithOneRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`,
      {
        'x-goog-api-key': config.geminiApiKey,
        'Content-Type': 'application/json',
      },
      body,
      fetchImpl
    )
  }

  const recognizeIngredients = async (
    image: UploadedImage
  ): Promise<IngredientRecognitionResult> => {
    const payload = await postGemini({
      contents: [
        {
          role: 'user',
          parts: [
            { text: recognitionPrompt },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.bytes.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: ingredientRecognitionJsonSchema,
        temperature: 0,
      },
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
      const payload = await postGemini({
        contents: [
          {
            role: 'user',
            parts: [{ text: nutritionPrompt(input) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: nutritionBlueprintJsonSchema,
          temperature: 0,
        },
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
