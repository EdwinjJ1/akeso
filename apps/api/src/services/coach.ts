import type {
  CoachChatBlueprint,
  CoachReply,
  DayPlan,
} from '@akeso/domain'

import type { CoachChatInput } from './types'

export const COACH_DISCLAIMER =
  'Akeso is an energy coach, not a medical device. Suggestions are based on your own check-ins and plan, not clinical measurements.'

export const COACH_CHAT_PROMPT_VERSION = 1

/**
 * Builds a coach response only from the user's persisted plan. This is the
 * honest fallback when the AI coach is unavailable: no fictional
 * suggestions or sample check-in data are substituted.
 */
export function buildCoachReplyFromPlan(plan: DayPlan): CoachReply {
  return {
    message: plan.coachNote,
    suggestions: [],
    adjustedPlan: plan,
    disclaimer: COACH_DISCLAIMER,
  }
}

/**
 * Evidence refs the AI may cite: the user's real energy factor keys plus the
 * ids of blocks in their persisted plan. Anything else is a hallucination
 * and gets dropped during grounding.
 */
export function allowedCoachEvidenceRefs(input: CoachChatInput): string[] {
  return [
    ...input.energy.factors.map((factor) => factor.key),
    ...input.plan.blocks.map((block) => block.id),
  ]
}

export function coachChatPrompt(input: CoachChatInput): string {
  const context = {
    date: input.date,
    energy: {
      score: input.energy.score,
      band: input.energy.band,
      headline: input.energy.headline,
      factors: input.energy.factors.map((factor) => ({
        key: factor.key,
        label: factor.label,
        explanation: factor.explanation,
      })),
      peakWindow: input.energy.peakWindow,
      dipWindow: input.energy.dipWindow,
    },
    plan: {
      coachNote: input.plan.coachNote,
      blocks: input.plan.blocks.map((block) => ({
        id: block.id,
        start: block.start,
        end: block.end,
        type: block.type,
        title: block.title,
        energyLevel: block.energyLevel,
      })),
    },
  }
  return `You are Akeso, a warm and practical energy coach inside a wellbeing app. Answer the user's message using ONLY the JSON context below — it is the user's own check-in result and day plan for ${input.date}.

Rules:
- Answer the user's message directly and specifically in at most 90 words, referencing their real energy score, band, peak/dip windows, or plan blocks where relevant.
- General wellbeing guidance only. Never give medical, diagnostic, medication, supplement, or calorie advice. If asked for medical advice, gently redirect to a professional.
- Never invent check-in data, plan blocks, foods in their fridge, or anything else not present in the context.
- Optionally add up to 3 suggestions. Each needs a short title, a one-sentence detail, and basedOn: refs copied EXACTLY from the allowed list below. A suggestion without a valid ref will be discarded.
- Return exactly one JSON object with this shape and no markdown:
{"message":"...","suggestions":[{"title":"...","detail":"...","basedOn":["reported_energy"]}]}

Allowed basedOn refs: ${JSON.stringify(allowedCoachEvidenceRefs(input))}
User message: ${JSON.stringify(input.message)}
Context: ${JSON.stringify(context)}`
}

export const coachChatJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'suggestions'],
  properties: {
    message: { type: 'string', minLength: 1 },
    suggestions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'basedOn'],
        properties: {
          title: { type: 'string', minLength: 1 },
          detail: { type: 'string', minLength: 1 },
          basedOn: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  },
} as const

/**
 * Turns validated AI chat output into a CoachReply the app can trust:
 * suggestion evidence is filtered to the user's real factor keys / block
 * ids (phantom refs are dropped, and a suggestion left with no evidence is
 * discarded), ids are server-assigned, and the non-clinical disclaimer plus
 * the persisted plan are always attached.
 */
export function groundCoachChatReply(
  blueprint: CoachChatBlueprint,
  input: CoachChatInput
): CoachReply {
  const allowedRefs = new Set(allowedCoachEvidenceRefs(input))
  const suggestions = blueprint.suggestions.flatMap((suggestion, index) => {
    const basedOn = Array.from(
      new Set(suggestion.basedOn.filter((ref) => allowedRefs.has(ref)))
    )
    return basedOn.length > 0
      ? [
          {
            id: `coach-sug-${index + 1}`,
            title: suggestion.title,
            detail: suggestion.detail,
            basedOn,
          },
        ]
      : []
  })
  return {
    message: blueprint.message,
    suggestions,
    adjustedPlan: input.plan,
    disclaimer: COACH_DISCLAIMER,
  }
}
