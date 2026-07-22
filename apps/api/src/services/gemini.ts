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
  if (!Array.isArray(payload.candidates)) {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  const first = payload.candidates[0]
  const content =
    typeof first === 'object' && first !== null && !Array.isArray(first)
      ? (first as Record<string, unknown>).content
      : undefined
  const parts =
    typeof content === 'object' && content !== null && !Array.isArray(content)
      ? (content as Record<string, unknown>).parts
      : undefined
  if (!Array.isArray(parts)) {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  const text = parts
    .map((part) =>
      typeof part === 'object' && part !== null && !Array.isArray(part)
        ? (part as Record<string, unknown>).text
        : undefined
    )
    .map((partText) => (typeof partText === 'string' ? partText : ''))
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
