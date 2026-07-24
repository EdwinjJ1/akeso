import type {
  CoachChatBlueprint,
  CoachReply,
  DayPlan,
} from '@akeso/domain'

import type { CoachChatInput } from './types'

export const COACH_DISCLAIMER =
  'Akeso is an energy coach, not a medical device. Suggestions are based on your own check-ins and plan, not clinical measurements.'

export const COACH_CHAT_PROMPT_VERSION = 2

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
 * Honest degradation for chat when the AI provider is unavailable: composed
 * ONLY from the user's real persisted data (headline, coach note), with the
 * outage stated plainly — never a canned fake conversation.
 */
export function buildCoachUnavailableReply(input: CoachChatInput): CoachReply {
  const parts = [
    `Here's what today's data says: ${input.energy.headline}`,
    ...(input.plan ? [input.plan.coachNote] : []),
    'I can’t reach my reasoning service right now, so ask me again in a moment for a fuller answer.',
  ]
  return {
    message: parts.join(' '),
    suggestions: [],
    ...(input.plan ? { adjustedPlan: input.plan } : {}),
    disclaimer: COACH_DISCLAIMER,
  }
}

/**
 * Evidence refs the AI may cite: the user's real energy factor keys, the ids
 * of blocks in their persisted plan, their confirmed report metric ids, and
 * their context note ids. Anything else is a hallucination and gets dropped
 * during grounding.
 */
export function allowedCoachEvidenceRefs(input: CoachChatInput): string[] {
  return [
    ...input.energy.factors.map((factor) => factor.key),
    ...(input.plan?.blocks.map((block) => block.id) ?? []),
    ...input.reports.flatMap((report) =>
      report.metrics.map((metric) => metric.id)
    ),
    ...input.contextNotes.map((note) => note.id),
  ]
}

/** Sent as the user turn when the coach opens the "Tell Akeso more" flow. */
export const COACH_OPENER_INSTRUCTION =
  'Look at my context and ask me exactly ONE short, friendly follow-up question about the biggest gap in what you know about my day (mood, food, stress, symptoms — your pick). One question only, no preamble, no suggestions.'

/**
 * The full picture the coach reasons over, compacted to keep the prompt
 * small: profile is allowlisted (no free-text safety notes), report metrics
 * are the confirmed ones the route already filtered, and the energy object
 * carries the user's manual adjustment when present. Nothing here describes
 * how the score is computed.
 */
function coachChatContext(input: CoachChatInput) {
  return {
    date: input.date,
    profile: input.profile
      ? {
          displayName: input.profile.displayName,
          goal: input.profile.goal,
          typicalWake: input.profile.typicalWake,
          typicalSleep: input.profile.typicalSleep,
          dietaryPreference: input.profile.dietaryPreference,
        }
      : null,
    checkin: input.checkin
      ? {
          reportedEnergy: input.checkin.reportedEnergy,
          sleepDuration: input.checkin.sleepDuration,
          lastMealTiming: input.checkin.lastMealTiming,
          ...(input.checkin.lastMealDescription
            ? { lastMealDescription: input.checkin.lastMealDescription }
            : {}),
          hydration: input.checkin.hydration,
        }
      : null,
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
      ...(input.energy.adjustment
        ? {
            userAdjustedScore: {
              from: input.energy.adjustment.originalScore,
              to: input.energy.adjustment.adjustedScore,
              ...(input.energy.adjustment.note
                ? { theirNote: input.energy.adjustment.note }
                : {}),
            },
          }
        : {}),
    },
    plan: input.plan
      ? {
          coachNote: input.plan.coachNote,
          blocks: input.plan.blocks.map((block) => ({
            id: block.id,
            start: block.start,
            end: block.end,
            type: block.type,
            title: block.title,
            energyLevel: block.energyLevel,
          })),
        }
      : null,
    fridge: input.fridge.map((item) => item.name),
    healthReports: input.reports.map((report) => ({
      name: report.name,
      reportDate: report.reportDate,
      metrics: report.metrics.map((metric) => ({
        id: metric.id,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        status: metric.status,
      })),
    })),
    userNotesToday: input.contextNotes.map((note) => ({
      id: note.id,
      from: note.author,
      text: note.text,
    })),
  }
}

/**
 * System-style instruction carrying the rules and the user's own data. The
 * conversation itself (history + current message) travels as Gemini turns,
 * so multi-turn chats stay coherent without re-quoting the transcript here.
 */
export function coachChatPrompt(input: CoachChatInput): string {
  return `You are Akeso, the user's personal energy coach inside a wellbeing app. You know this user: the JSON context below is their own real data for ${input.date} — profile, check-in, energy result, day plan, fridge, confirmed health-report metrics, and notes they added today.

Rules:
- Answer directly and specifically in at most 110 words, quoting their own data (their name, energy band, peak/dip windows, plan blocks, fridge items, report metric names/values, their notes) where it genuinely helps — that is how they know you actually read it.
- If energy.userAdjustedScore exists, the user corrected the score themselves: treat their number as the truth, acknowledge it, and never argue with it.
- Never reveal or speculate about how any score is computed — no baselines, weights, points, or formulas.
- General wellbeing guidance only. Never give medical, diagnostic, medication, supplement, or calorie advice. If a report metric is out of range, you may note it factually and suggest discussing it with a professional. If asked for medical advice, gently redirect to a professional.
- Never invent data that is not in the context. If you don't have something, say so.
- Optionally add up to 3 suggestions. Each needs a short title, a one-sentence detail, and basedOn: refs copied EXACTLY from the allowed list below. A suggestion without a valid ref will be discarded.
- Return exactly one JSON object with this shape and no markdown:
{"message":"...","suggestions":[{"title":"...","detail":"...","basedOn":["reported_energy"]}]}

Allowed basedOn refs: ${JSON.stringify(allowedCoachEvidenceRefs(input))}
Context: ${JSON.stringify(coachChatContext(input))}`
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
 * ids / confirmed metric ids / note ids (phantom refs are dropped, and a
 * suggestion left with no evidence is discarded), ids are server-assigned,
 * and the non-clinical disclaimer plus the persisted plan are always
 * attached.
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
    ...(input.plan ? { adjustedPlan: input.plan } : {}),
    disclaimer: COACH_DISCLAIMER,
  }
}
