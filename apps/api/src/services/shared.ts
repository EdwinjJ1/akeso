import {
  buildInventoryNutritionFallback,
  nutritionPlanSchema,
  type NutritionPlan,
} from '@akeso/domain'

import { HttpError } from '../http-error'
import type { NutritionGenerationInput } from './types'

export const REQUEST_TIMEOUT_MS = 15_000
export const NUTRITION_PROMPT_VERSION = 3

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

The output must match exactly one of these shapes. Never omit ingredients and never invent another status:
{"status":"ok","ingredients":[{"name":"tomato","category":"vegetable","confidence":0.95,"uncertaintyReason":null}]}
{"status":"empty","ingredients":[],"reason":"no_food_detected"}
{"status":"empty","ingredients":[],"reason":"unrecognizable_image"}
{"status":"refused","ingredients":[],"reason":"brief policy reason"}

For status "ok", every ingredient must include exactly name, category, confidence, and uncertaintyReason. Allowed categories are protein, vegetable, fruit, dairy, grain, and other.`

export const nutritionPrompt = (input: NutritionGenerationInput) => `Create a practical, non-medical nutrition plan for ${input.date} from the exact JSON context below.

Rules:
- Use only fridge items supplied in context. Every itemIds value must exactly match one supplied id.
- Never add an ingredient, quantity, weight, grams, expiry date, supplement, or medical claim.
- Respect dietaryPreference. If inventory is empty, return no meals.
- Low energy meals must take at most 15 minutes; all others at most 30.
- needs are qualitative priority keys inferred for this day, not measured intake.
- Return a text-free blueprint using only confirmed item IDs and safe cooking methods. Return exactly this shape and no other keys:
{
  "date": "${input.date}",
  "needs": ["protein"],
  "meals": [{"slot":"breakfast","itemIds":["an exact supplied id"],"actions":[{"method":"slice","itemIds":["an exact supplied id"]}],"boosts":["protein"],"prepMinutes":10}]
}
- needs may contain only protein, complex_carbs, iron, vitamin_c, omega3, hydration, fiber.
- Every itemIds value must exactly match a supplied fridge id. Every action itemIds value must also occur in its meal itemIds.
- action method must be one of serve, slice, chop, mix, combine, heat, cook, toast, blend.
- Every meal object MUST contain exactly slot, itemIds, actions, boosts, prepMinutes. slot is one of breakfast, lunch, dinner, snack.
- If no qualitative nutrient priority is justified, use an empty needs array. If no feasible meal exists, use an empty meals array.
- One confirmed ingredient can still be a simple snack or serving suggestion; do not demand additional foods when that ingredient is safely usable on its own.
- Do not output food names, meal titles, descriptions, tags, rationale, or any other free text. The server renders text only from confirmed item IDs.

Context: ${JSON.stringify(input)}`

export const ingredientRecognitionJsonSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'ingredients'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        ingredients: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'category', 'confidence', 'uncertaintyReason'],
            properties: {
              name: { type: 'string' },
              category: {
                type: 'string',
                enum: [
                  'protein',
                  'vegetable',
                  'fruit',
                  'dairy',
                  'grain',
                  'other',
                ],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              uncertaintyReason: {
                anyOf: [
                  { type: 'string' },
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
        status: { type: 'string', enum: ['empty'] },
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
        status: { type: 'string', enum: ['refused'] },
        ingredients: { type: 'array', maxItems: 0 },
        reason: { type: 'string' },
      },
    },
  ],
} as const

export const nutritionBlueprintJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'needs', 'meals'],
  properties: {
    date: { type: 'string' },
    needs: {
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
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'itemIds', 'actions', 'boosts', 'prepMinutes'],
        properties: {
          slot: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          },
          itemIds: { type: 'array', minItems: 1, items: { type: 'string' } },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['method', 'itemIds'],
              properties: {
                method: {
                  type: 'string',
                  enum: [
                    'serve',
                    'slice',
                    'chop',
                    'mix',
                    'combine',
                    'heat',
                    'cook',
                    'toast',
                    'blend',
                  ],
                },
                itemIds: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string' },
                },
              },
            },
          },
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
        },
      },
    },
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
        let payload: unknown
        try {
          payload = await response.json()
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw error
          throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned invalid JSON.')
        }
        if (
          typeof payload !== 'object' ||
          payload === null ||
          Array.isArray(payload)
        ) {
          throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned invalid JSON.')
        }
        return payload as Record<string, unknown>
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

export function normalizeRecognitionResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
  const record = value as Record<string, unknown>
  if (
    (record.status === 'empty' || record.status === 'refused') &&
    !Object.hasOwn(record, 'ingredients')
  ) {
    return { ...record, ingredients: [] }
  }
  return value
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

const nutrientKeys = [
  'protein',
  'complex_carbs',
  'iron',
  'vitamin_c',
  'omega3',
  'hydration',
  'fiber',
] as const
type NutrientKey = (typeof nutrientKeys)[number]

const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealSlot = (typeof mealSlots)[number]

const cookingMethods = [
  'serve',
  'slice',
  'chop',
  'mix',
  'combine',
  'heat',
  'cook',
  'toast',
  'blend',
] as const
type CookingMethod = (typeof cookingMethods)[number]

interface NutritionBlueprint {
  date: string
  needs: NutrientKey[]
  meals: Array<{
    slot: MealSlot
    itemIds: string[]
    actions: Array<{ method: CookingMethod; itemIds: string[] }>
    boosts: NutrientKey[]
    prepMinutes: number
  }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

function parseNutritionBlueprint(value: unknown): NutritionBlueprint | undefined {
  if (!isRecord(value) || typeof value.date !== 'string') return undefined
  if (!isStringArray(value.needs)) return undefined
  if (!value.needs.every((key) => nutrientKeys.includes(key as NutrientKey))) {
    return undefined
  }
  if (!Array.isArray(value.meals)) return undefined

  const meals: NutritionBlueprint['meals'] = []
  for (const rawMeal of value.meals) {
    if (!isRecord(rawMeal)) return undefined
    if (
      typeof rawMeal.slot !== 'string' ||
      !mealSlots.includes(rawMeal.slot as MealSlot) ||
      !isStringArray(rawMeal.itemIds) ||
      rawMeal.itemIds.length === 0 ||
      !isStringArray(rawMeal.boosts) ||
      !rawMeal.boosts.every((key) => nutrientKeys.includes(key as NutrientKey)) ||
      !Number.isInteger(rawMeal.prepMinutes) ||
      Number(rawMeal.prepMinutes) <= 0 ||
      !Array.isArray(rawMeal.actions) ||
      rawMeal.actions.length === 0
    ) {
      return undefined
    }

    const actions: NutritionBlueprint['meals'][number]['actions'] = []
    for (const rawAction of rawMeal.actions) {
      if (
        !isRecord(rawAction) ||
        typeof rawAction.method !== 'string' ||
        !cookingMethods.includes(rawAction.method as CookingMethod) ||
        !isStringArray(rawAction.itemIds) ||
        rawAction.itemIds.length === 0
      ) {
        return undefined
      }
      actions.push({
        method: rawAction.method as CookingMethod,
        itemIds: rawAction.itemIds,
      })
    }

    meals.push({
      slot: rawMeal.slot as MealSlot,
      itemIds: rawMeal.itemIds,
      actions,
      boosts: rawMeal.boosts as NutrientKey[],
      prepMinutes: Number(rawMeal.prepMinutes),
    })
  }

  return {
    date: value.date,
    needs: value.needs as NutrientKey[],
    meals,
  }
}

const nutrientLabels: Record<NutrientKey, string> = {
  protein: 'Protein priority',
  complex_carbs: 'Complex carbohydrate priority',
  iron: 'Iron priority',
  vitamin_c: 'Vitamin C priority',
  omega3: 'Omega-3 priority',
  hydration: 'Hydration priority',
  fiber: 'Fiber priority',
}

const actionPresentation: Record<
  CookingMethod,
  { titlePrefix: string; verb: string }
> = {
  serve: { titlePrefix: '', verb: 'Serve' },
  slice: { titlePrefix: 'Sliced', verb: 'Slice' },
  chop: { titlePrefix: 'Chopped', verb: 'Chop' },
  mix: { titlePrefix: 'Mixed', verb: 'Mix' },
  combine: { titlePrefix: 'Combined', verb: 'Combine' },
  heat: { titlePrefix: 'Warmed', verb: 'Warm' },
  cook: { titlePrefix: 'Cooked', verb: 'Cook' },
  toast: { titlePrefix: 'Toasted', verb: 'Toast' },
  blend: { titlePrefix: 'Blended', verb: 'Blend' },
}

export function validateNutritionPlanOutput(
  input: NutritionGenerationInput,
  value: unknown
): NutritionPlan | undefined {
  const blueprint = parseNutritionBlueprint(value)
  if (!blueprint || blueprint.date !== input.date) return undefined

  const maxPrepMinutes = input.energy?.band === 'low' ? 15 : 30
  if (blueprint.meals.some((meal) => meal.prepMinutes > maxPrepMinutes)) {
    return undefined
  }

  const preference = input.profile?.dietaryPreference ?? 'none'
  const itemById = new Map(input.fridge.map((item) => [item.id, item]))
  const allowedForPreference = (category: (typeof input.fridge)[number]['category']) => {
    if (preference === 'vegan') {
      return category !== 'protein' && category !== 'dairy'
    }
    if (preference === 'vegetarian' || preference === 'halal') {
      return category !== 'protein'
    }
    if (preference === 'gluten_free') return category !== 'grain'
    return true
  }

  const groundedNeeds = [...new Set(blueprint.needs)].map((key) => ({
    key,
    label: nutrientLabels[key],
    current: 0,
    target: 1,
    unit: 'priority',
    note: `Qualitative ${nutrientLabels[key].toLowerCase()} for today.`,
  }))

  /*
   * Provider prose cannot be reliably checked for arbitrary food names. Keep
   * the useful structured choices, but derive every displayed string from
   * confirmed inventory and fixed vocabulary. Dietary enforcement is
   * deliberately conservative because FridgeItem only has broad categories:
   * it cannot distinguish plant/animal protein, gluten-free grains, halal
   * protein, or ambiguous "other" items.
   */
  const groundedMeals = []
  for (const [mealIndex, meal] of blueprint.meals.entries()) {
    const items = meal.itemIds.map((id) => itemById.get(id))
    if (items.some((item) => item === undefined)) return undefined
    const confirmedItems = items.filter((item) => item !== undefined)
    const mealIdSet = new Set(meal.itemIds)
    if (
      meal.actions.some((action) =>
        action.itemIds.some((id) => !mealIdSet.has(id) || !itemById.has(id))
      )
    ) {
      return undefined
    }
    if (confirmedItems.some((item) => !allowedForPreference(item.category))) {
      continue
    }

    const names = confirmedItems.map((item) => item.name)
    const primary = actionPresentation[meal.actions[0].method]
    const description = meal.actions
      .map((action) => {
        const actionNames = action.itemIds.map((id) => itemById.get(id)!.name)
        return `${actionPresentation[action.method].verb} ${actionNames.join(' + ')}.`
      })
      .join(' ')
    groundedMeals.push({
      id: `meal-${mealIndex + 1}`,
      slot: meal.slot,
      title: `${primary.titlePrefix ? `${primary.titlePrefix} ` : ''}${names.join(' + ')}`,
      description,
      usesFridgeItemIds: meal.itemIds,
      boosts: meal.boosts,
      prepMinutes: meal.prepMinutes,
      tags: [...new Set([...meal.actions.map((action) => action.method), 'confirmed inventory'])],
    })
  }

  const preferenceLabel = preference.replace('_', ' ')
  const grounded = nutritionPlanSchema.safeParse({
    date: input.date,
    needs: groundedNeeds,
    fridge: input.fridge,
    meals: groundedMeals,
    rationale:
      preference === 'none'
        ? `Recommendations use only confirmed fridge items and reflect today’s ${input.energy?.band ?? 'moderate'} energy.`
        : `Recommendations use only confirmed fridge items and conservatively apply the ${preferenceLabel} preference for today’s ${input.energy?.band ?? 'moderate'} energy.`,
  })
  return grounded.success ? grounded.data : undefined
}
