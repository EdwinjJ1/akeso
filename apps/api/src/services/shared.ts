import {
  buildInventoryNutritionFallback,
  nutritionPlanSchema,
  type NutritionPlan,
} from '@akeso/domain'

import { HttpError } from '../http-error'
import type { NutritionGenerationInput } from './types'

export const REQUEST_TIMEOUT_MS = 15_000
export const NUTRITION_PROMPT_VERSION = 2

export const AI_UNAVAILABLE_MESSAGE =
  'Fridge recognition is unavailable; use manual ingredient entry.'

export const recognitionPrompt = `Identify only food ingredients visibly present in this image.

Rules:
- Presence only: never output quantities, units, weights, grams, expiry dates, or inferred hidden contents.
- Deduplicate repeated containers into one ingredient.
- Use concise English ingredient names and exactly one allowed category.
- Set uncertaintyReason to null when confident; otherwise explain the visual ambiguity briefly.
- Include only a concrete edible ingredient identified from visible appearance or a readable label.
- Omit containers and unidentified contents. Never emit generic placeholders.
- If there is no visible food ingredient, return status "empty" with reason "no_food_detected".
- If the image is too unclear to identify food safely, return status "empty" with reason "unrecognizable_image".
- If policy prevents processing, return status "refused" and no ingredients.
- Return exactly one JSON object and no markdown or surrounding prose.

For status "ok", every ingredient must include exactly name, category, confidence, and uncertaintyReason. Allowed categories are protein, vegetable, fruit, dairy, grain, and other.`

export const nutritionPrompt = (input: NutritionGenerationInput) => `Create a practical, non-medical nutrition plan for ${input.date} from the exact JSON context below.

Rules:
- Use only fridge items supplied in context. Every usesFridgeItemIds value must exactly match one supplied id.
- Do not mention, suggest, compare with, or give examples of any unavailable food anywhere in needs, meal titles, descriptions, tags, or rationale.
- Never add an ingredient, quantity, weight, grams, expiry date, supplement, or medical claim.
- Respect dietaryPreference. If inventory is empty, return no meals and clearly ask the user to add ingredients.
- Low energy meals must take at most 15 minutes; all others at most 30.
- needs are qualitative priorities inferred for this day, not measured intake: use current 0, target 1, unit "priority". Use only keys protein, complex_carbs, iron, vitamin_c, omega3, hydration, fiber.
- Return exactly this flat JSON shape and no other keys:
{
  "date": "${input.date}",
  "needs": [{"key":"protein","label":"short priority label","current":0,"target":1,"unit":"priority","note":"why it matters today"}],
  "fridge": ${JSON.stringify(input.fridge)},
  "meals": [{"id":"meal-1","slot":"breakfast","title":"meal name","description":"brief preparation using only listed items","usesFridgeItemIds":["an exact supplied id"],"boosts":["protein"],"prepMinutes":10,"tags":["short tag"]}],
  "rationale": "how confirmed inventory, energy and preference shaped this"
}
- needs MUST be an array, never an object keyed by nutrient. meals MUST be an array of flat meal objects, never objects keyed by breakfast/lunch/dinner.
- Every meal object MUST contain exactly id, slot, title, description, usesFridgeItemIds, boosts, prepMinutes, tags. slot is one of breakfast, lunch, dinner, snack.
- If no qualitative nutrient priority is justified, use an empty needs array. If no feasible meal exists, use an empty meals array.
- One confirmed ingredient can still be a simple snack or serving suggestion; do not demand additional foods when that ingredient is safely usable on its own.
- Echo the context fridge array exactly; do not rename or recategorize it.

Context: ${JSON.stringify(input)}`

export const ingredientRecognitionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'ingredients'],
  properties: {
    status: { type: 'string', enum: ['ok', 'empty', 'refused'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'category', 'confidence', 'uncertaintyReason'],
        properties: {
          name: { type: 'string' },
          category: {
            type: 'string',
            enum: ['protein', 'vegetable', 'fruit', 'dairy', 'grain', 'other'],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          uncertaintyReason: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
      },
    },
    reason: { type: 'string' },
  },
} as const

export const nutritionPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'needs', 'fridge', 'meals', 'rationale'],
  properties: {
    date: { type: 'string' },
    needs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'label', 'current', 'target', 'unit'],
        properties: {
          key: {
            type: 'string',
            enum: [
              'protein',
              'complex_carbs',
              'iron',
              'vitamin_c',
              'omega3',
              'hydration',
              'fiber',
            ],
          },
          label: { type: 'string' },
          current: { type: 'number' },
          target: { type: 'number' },
          unit: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    fridge: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'category'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: {
            type: 'string',
            enum: ['protein', 'vegetable', 'fruit', 'dairy', 'grain', 'other'],
          },
        },
      },
    },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'slot',
          'title',
          'description',
          'usesFridgeItemIds',
          'boosts',
          'prepMinutes',
          'tags',
        ],
        properties: {
          id: { type: 'string' },
          slot: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          usesFridgeItemIds: { type: 'array', items: { type: 'string' } },
          boosts: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'protein',
                'complex_carbs',
                'iron',
                'vitamin_c',
                'omega3',
                'hydration',
                'fiber',
              ],
            },
          },
          prepMinutes: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    rationale: { type: 'string' },
  },
} as const

class ProviderHttpError extends Error {
  constructor(public readonly status: number) {
    super(`AI provider request failed with HTTP ${status}`)
  }
}

const retryable = (status: number) =>
  status === 429 || (status >= 500 && status <= 599)

export async function postJsonWithOneRetry(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetchImpl: typeof fetch
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (response.ok) {
        try {
          return (await response.json()) as Record<string, unknown>
        } catch {
          throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned invalid JSON.')
        }
      }
      if (attempt === 0 && retryable(response.status)) continue
      throw new ProviderHttpError(response.status)
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (error instanceof ProviderHttpError) {
        throw new HttpError(
          error.status === 429 ? 503 : 502,
          error.status === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_ERROR',
          error.status === 429
            ? 'AI is busy; keep editing manually and try once more.'
            : 'AI provider request failed.'
        )
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(
          504,
          'AI_TIMEOUT',
          'AI request timed out; keep editing manually.'
        )
      }
      throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider request failed.')
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider retry failed.')
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned malformed output.')
  }
}

export function unavailableError(): HttpError {
  return new HttpError(503, 'AI_UNAVAILABLE', AI_UNAVAILABLE_MESSAGE)
}

export function fallbackNutrition(input: NutritionGenerationInput): NutritionPlan {
  return buildInventoryNutritionFallback({
    date: input.date,
    fridge: input.fridge,
    energyBand: input.energy?.band ?? 'moderate',
    dietaryPreference: input.profile?.dietaryPreference ?? 'none',
    needs: [],
  })
}

export function validateNutritionPlanOutput(
  input: NutritionGenerationInput,
  value: unknown
): NutritionPlan | undefined {
  const parsed = nutritionPlanSchema.safeParse(value)
  if (!parsed.success) return undefined

  const plan = parsed.data
  const maxPrepMinutes = input.energy?.band === 'low' ? 15 : 30
  if (
    plan.date !== input.date ||
    JSON.stringify(plan.fridge) !== JSON.stringify(input.fridge) ||
    plan.meals.some((meal) => meal.prepMinutes > maxPrepMinutes)
  ) {
    return undefined
  }
  return plan
}
