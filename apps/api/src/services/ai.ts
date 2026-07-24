import { env } from '../env'
import { buildReportRecommendationBlueprint } from '@akeso/domain'
import { buildCoachReplyFromPlan } from './coach'
import { createGeminiAiServices } from './gemini'
import {
  fallbackNutrition,
  NUTRITION_PROMPT_VERSION,
  unavailableError,
} from './shared'
import type { AiServices, VisionConfig } from './types'

type ProviderFactory = (
  config: VisionConfig,
  fetchImpl: typeof fetch
) => AiServices

const providerRegistry = new Map<string, ProviderFactory>([
  ['gemini', createGeminiAiServices],
])

const unavailableServices: AiServices = {
  async recognizeIngredients() {
    throw unavailableError('fridge')
  },
  async generateNutrition(input) {
    return fallbackNutrition(input)
  },
  async extractReportMetrics() {
    throw unavailableError('report')
  },
  async generateHealthRecommendations(input) {
    return buildReportRecommendationBlueprint({
      report: input.report,
      profile: input.profile,
    })
  },
  async generateCoachReply(input) {
    return buildCoachReplyFromPlan(input.plan)
  },
}

export function createAiServices(
  config: VisionConfig = env.vision,
  fetchImpl: typeof fetch = fetch
): AiServices {
  if (!config.enabled) return unavailableServices
  const factory = providerRegistry.get(config.provider)
  return factory ? factory(config, fetchImpl) : unavailableServices
}

export function getSelectedVisionIdentity(config: VisionConfig = env.vision): {
  provider: string
  model: string
} {
  const model =
    config.provider === 'gemini' ? config.geminiModel : 'unconfigured'
  return { provider: config.provider, model }
}

export { NUTRITION_PROMPT_VERSION }
