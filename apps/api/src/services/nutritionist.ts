import {
  REPORT_CHAT_DISCLAIMER,
  type HealthReport,
  type HealthRecommendationProfileContext,
  type ReportChatBlueprint,
  type ReportChatReply,
} from '@akeso/domain'

import type { ReportNutritionChatInput } from './types'

/**
 * Reference-only disclaimer — attached server-side to EVERY nutritionist
 * reply (AI or fallback). The provider never authors this text.
 */
export const NUTRITIONIST_DISCLAIMER = REPORT_CHAT_DISCLAIMER

export const NUTRITIONIST_CHAT_PROMPT_VERSION = 1

/** Cap replayed history so a long chat cannot bloat the prompt. */
const MAX_HISTORY_TURNS = 8

/**
 * Honest degradation when the AI nutritionist is unavailable: no fictional
 * dietary advice is substituted — the user is told to retry instead.
 */
export function buildNutritionistFallbackReply(): ReportChatReply {
  return {
    message:
      'The nutritionist is unavailable right now, so I can’t give dietary suggestions for this report yet. Your confirmed results are saved — please try again in a moment.',
    disclaimer: NUTRITIONIST_DISCLAIMER,
  }
}

/**
 * The exact context the nutritionist may see: confirmed metrics from the
 * user's own report plus the strict profile allowlist. Unconfirmed metrics,
 * profile names, and free-text profile fields never cross this boundary.
 */
function nutritionistContext(
  report: HealthReport,
  profile: HealthRecommendationProfileContext | null
) {
  return {
    report: {
      name: report.name,
      reportDate: report.reportDate,
      confirmedMetrics: report.metrics
        .filter((metric) => metric.confirmed)
        .map((metric) => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          referenceLow: metric.referenceLow,
          referenceHigh: metric.referenceHigh,
          status: metric.status,
        })),
    },
    profile,
  }
}

export function nutritionistChatPrompt(input: ReportNutritionChatInput): string {
  const history = input.history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
    role: turn.role,
    text: turn.text,
  }))
  return `You are a top registered nutritionist inside Akeso, a wellbeing app. The user has confirmed lab-report values, shown in the JSON context below. Answer their message with practical, food-first dietary guidance tailored to those values and their dietary preference.

Rules:
- Use ONLY the JSON context below. Never invent metrics, results, conditions, or personal details not present in it.
- Base advice only on confirmedMetrics. If a value the user asks about is not there, say you can only discuss confirmed values.
- Respect profile.dietaryPreference strictly when suggesting foods (e.g. never suggest meat to a vegetarian).
- Dietary and lifestyle guidance only: never diagnose, never mention diseases the user did not mention, never advise on medication, and never give supplement doses. For out-of-range values, food-first suggestions plus encouraging a professional follow-up is the right scope.
- Remind the user briefly that this is general guidance for reference only, not medical advice.
- Answer in at most 130 words, warm and specific. Reply in the language the user wrote in.
- Return exactly one JSON object with this shape and no markdown: {"message":"..."}

Conversation so far: ${JSON.stringify(history)}
User message: ${JSON.stringify(input.message)}
Context: ${JSON.stringify(nutritionistContext(input.report, input.profile))}`
}

export const nutritionistChatJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1 },
  },
} as const

/**
 * Turns validated AI output into the reply the app can trust: the message is
 * the model's, but the reference-only disclaimer is always server-attached.
 */
export function groundNutritionistReply(
  blueprint: ReportChatBlueprint
): ReportChatReply {
  return {
    message: blueprint.message,
    disclaimer: NUTRITIONIST_DISCLAIMER,
  }
}
