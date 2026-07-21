import {
  buildInventoryNutritionFallback,
  ingredientRecognitionResultSchema,
  nutritionPlanSchema,
  type IngredientRecognitionResult,
  type NutritionPlan,
} from '@akeso/domain'

import { env } from '../env'
import { HttpError } from '../http-error'
import type { AiServices, NutritionGenerationInput, UploadedImage } from './types'

const MIMO_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 15_000
export const NUTRITION_PROMPT_VERSION = 2

const recognitionPrompt = `Identify only food ingredients visibly present in this image.

Return exactly one JSON object. Presence only: never output quantities, units, weights, grams, expiry dates, or hidden contents. Deduplicate repeated items. Use concise names and one category from protein, vegetable, fruit, dairy, grain, other. Omit containers, unknown contents, and generic placeholders. If no food is visible use {"status":"empty","ingredients":[],"reason":"no_food_detected"}; if too unclear use reason "unrecognizable_image"; if policy prevents processing use status "refused" with no ingredients. Otherwise use {"status":"ok","ingredients":[{"name":"ingredient","category":"vegetable","confidence":0.9,"uncertaintyReason":null}]}. Every ok ingredient has exactly those four fields.`

class ProviderHttpError extends Error {
  constructor(public readonly status: number) {
    super(`MiMo request failed with HTTP ${status}`)
  }
}

const retryable = (status: number) =>
  status === 429 || (status >= 500 && status <= 599)

async function postMiMo(body: unknown): Promise<Record<string, unknown>> {
  const key = env.vision.mimoApiKey
  if (!env.vision.enabled || env.vision.provider !== 'mimo' || !key) {
    throw new HttpError(
      503,
      'AI_UNAVAILABLE',
      'Fridge recognition is unavailable; use manual ingredient entry.'
    )
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(MIMO_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
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
        throw new HttpError(504, 'AI_TIMEOUT', 'AI request timed out; keep editing manually.')
      }
      throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider request failed.')
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider retry failed.')
}

function outputText(payload: Record<string, unknown>): string {
  const first = Array.isArray(payload.choices)
    ? (payload.choices[0] as { message?: { content?: unknown } } | undefined)
    : undefined
  const content = first?.message?.content
  if (typeof content !== 'string') {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned no structured output.')
  }
  return content
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI returned malformed output.')
  }
}

async function recognizeIngredients(
  image: UploadedImage
): Promise<IngredientRecognitionResult> {
  const payload = await postMiMo({
    model: env.vision.mimoModel,
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
    parseJson(outputText(payload))
  )
  if (!parsed.success) {
    throw new HttpError(502, 'MALFORMED_AI_OUTPUT', 'AI output failed validation.')
  }
  return parsed.data
}

const nutritionPrompt = (input: NutritionGenerationInput) => `Create a practical, non-medical nutrition plan for ${input.date} from the exact JSON context below.

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

async function generateNutritionWithMiMo(
  input: NutritionGenerationInput
): Promise<NutritionPlan> {
  if (input.fridge.length === 0) {
    return buildInventoryNutritionFallback({
      date: input.date,
      fridge: [],
      energyBand: input.energy?.band ?? 'moderate',
      dietaryPreference: input.profile?.dietaryPreference ?? 'none',
      needs: [],
    })
  }

  try {
    const payload = await postMiMo({
      model: env.vision.mimoModel,
      messages: [{ role: 'user', content: nutritionPrompt(input) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 3_000,
      thinking: { type: 'disabled' },
      stream: false,
    })
    const parsed = nutritionPlanSchema.safeParse(parseJson(outputText(payload)))
    if (parsed.success) {
      // Never trust the model's echoed fridge array as the source of truth:
      // substitute the server's confirmed inventory and re-validate so a
      // meal referencing a hallucinated (non-existent) item id is rejected
      // here rather than reaching the client as a real inventory reference.
      const verified = nutritionPlanSchema.safeParse({
        ...parsed.data,
        fridge: input.fridge,
      })
      if (verified.success) return verified.data
      console.warn(
        'Nutrition AI referenced ingredients outside the confirmed inventory:',
        verified.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      )
    } else {
      console.warn(
        'Nutrition AI output failed schema validation:',
        parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      )
    }
  } catch (error) {
    // Recognition errors must surface, but nutrition always has a safe,
    // deterministic plan that uses only the user's confirmed inventory.
    console.warn(
      'Nutrition AI unavailable; using confirmed-inventory fallback:',
      error instanceof Error ? error.name : 'unknown error'
    )
  }

  return buildInventoryNutritionFallback({
    date: input.date,
    fridge: input.fridge,
    energyBand: input.energy?.band ?? 'moderate',
    dietaryPreference: input.profile?.dietaryPreference ?? 'none',
    needs: [],
  })
}

export function createAiServices(): AiServices {
  return {
    recognizeIngredients,
    generateNutrition: generateNutritionWithMiMo,
  }
}
