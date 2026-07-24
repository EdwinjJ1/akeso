import {
  buildReportRecommendationBlueprint,
  coachChatBlueprintSchema,
  healthRecommendationBlueprintSchema,
  ingredientRecognitionResultSchema,
  reportExtractionResultSchema,
  type CoachReply,
  type HealthRecommendationBlueprint,
  type IngredientRecognitionResult,
  type NutritionPlan,
  type ReportExtractionResult,
} from '@akeso/domain'

import { HttpError } from '../http-error'
import {
  buildCoachReplyFromPlan,
  coachChatJsonSchema,
  coachChatPrompt,
  groundCoachChatReply,
} from './coach'
import {
  buildRecommendationRequest,
  fallbackNutrition,
  groundRecommendationBlueprint,
  healthRecommendationJsonSchema,
  ingredientRecognitionJsonSchema,
  normalizeExtractionResult,
  normalizeRecognitionResult,
  nutritionBlueprintJsonSchema,
  nutritionPrompt,
  parseJson,
  postJsonWithOneRetry,
  recognitionPrompt,
  reportExtractionJsonSchema,
  reportExtractionPrompt,
  unavailableError,
  validateNutritionPlanOutput,
  type AiUnavailableContext,
} from './shared'
import type {
  AiServices,
  CoachChatInput,
  HealthRecommendationInput,
  NutritionGenerationInput,
  UploadedImage,
  VisionConfig,
} from './types'

function outputText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.candidates)) {
    throw new HttpError(
      502,
      'MALFORMED_AI_OUTPUT',
      'AI returned no structured output.'
    )
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
    throw new HttpError(
      502,
      'MALFORMED_AI_OUTPUT',
      'AI returned no structured output.'
    )
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
    throw new HttpError(
      502,
      'MALFORMED_AI_OUTPUT',
      'AI returned no structured output.'
    )
  }
  return text
}

export function createGeminiAiServices(
  config: VisionConfig,
  fetchImpl: typeof fetch
): AiServices {
  const postGemini = (body: unknown, context: AiUnavailableContext) => {
    if (!config.enabled || !config.geminiApiKey || !config.geminiModel) {
      throw unavailableError(context)
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
    const payload = await postGemini(
      {
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
      },
      'fridge'
    )
    const parsed = ingredientRecognitionResultSchema.safeParse(
      normalizeRecognitionResult(parseJson(outputText(payload)))
    )
    if (!parsed.success) {
      throw new HttpError(
        502,
        'MALFORMED_AI_OUTPUT',
        'AI output failed validation.'
      )
    }
    return parsed.data
  }

  const generateNutrition = async (
    input: NutritionGenerationInput
  ): Promise<NutritionPlan> => {
    if (input.fridge.length === 0) return fallbackNutrition(input)

    try {
      const payload = await postGemini(
        {
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
        },
        'generic'
      )
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

  const extractReportMetrics = async (
    image: UploadedImage
  ): Promise<ReportExtractionResult> => {
    const payload = await postGemini(
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: reportExtractionPrompt },
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
          responseJsonSchema: reportExtractionJsonSchema,
          temperature: 0,
        },
      },
      'report'
    )
    const parsed = reportExtractionResultSchema.safeParse(
      normalizeExtractionResult(parseJson(outputText(payload)))
    )
    if (!parsed.success) {
      throw new HttpError(
        502,
        'MALFORMED_AI_OUTPUT',
        'AI output failed validation.'
      )
    }
    return parsed.data
  }

  const generateHealthRecommendations = async (
    input: HealthRecommendationInput
  ): Promise<HealthRecommendationBlueprint> => {
    try {
      const { metricIdByRef, prompt } = buildRecommendationRequest(input)
      const payload = await postGemini(
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: healthRecommendationJsonSchema,
            temperature: 0,
          },
        },
        'report'
      )
      const parsed = healthRecommendationBlueprintSchema.safeParse(
        parseJson(outputText(payload))
      )
      if (parsed.success) {
        return groundRecommendationBlueprint(parsed.data, metricIdByRef)
      }
      // Log only issue paths — never metric names or values (health data).
      console.warn(
        'Health recommendation AI output failed blueprint validation at paths:',
        parsed.error.issues.map((issue) => issue.path)
      )
    } catch (error) {
      console.warn(
        'Health recommendation AI unavailable; using safe deterministic blueprint:',
        error instanceof Error ? error.name : 'unknown error'
      )
    }

    return buildReportRecommendationBlueprint({
      report: input.report,
      profile: input.profile,
    })
  }

  const generateCoachReply = async (
    input: CoachChatInput
  ): Promise<CoachReply> => {
    try {
      const payload = await postGemini(
        {
          contents: [
            { role: 'user', parts: [{ text: coachChatPrompt(input) }] },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: coachChatJsonSchema,
            temperature: 0.4,
          },
        },
        'generic'
      )
      const parsed = coachChatBlueprintSchema.safeParse(
        parseJson(outputText(payload))
      )
      if (parsed.success) return groundCoachChatReply(parsed.data, input)
      // Log only issue paths — never the user's message or check-in data.
      console.warn(
        'Coach AI output failed blueprint validation at paths:',
        parsed.error.issues.map((issue) => issue.path)
      )
    } catch (error) {
      console.warn(
        'Coach AI unavailable; using plan-based reply:',
        error instanceof Error ? error.name : 'unknown error'
      )
    }
    return buildCoachReplyFromPlan(input.plan)
  }

  return {
    recognizeIngredients,
    generateNutrition,
    extractReportMetrics,
    generateHealthRecommendations,
    generateCoachReply,
  }
}
