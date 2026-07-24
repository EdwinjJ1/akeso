import type {
  CoachReply,
  DayPlan,
  EnergyResult,
  FridgeItem,
  HealthReport,
  HealthRecommendationBlueprint,
  HealthRecommendationProfileContext,
  IngredientRecognitionResult,
  NutritionPlan,
  ReportExtractionResult,
  UserProfile,
} from '@akeso/domain'

export interface UploadedImage {
  bytes: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface NutritionGenerationInput {
  date: string
  fridge: FridgeItem[]
  energy: EnergyResult | null
  profile: UserProfile | null
}

/** Recommendations are grounded only in a report the user already confirmed. */
export interface HealthRecommendationInput {
  report: HealthReport
  /** Strict structured allowlist; null when the user has no saved profile. */
  profile: HealthRecommendationProfileContext | null
}

/**
 * Everything the chat coach may see: the user's message plus their own
 * persisted check-in result and plan for that day. No profile fields are
 * sent — the coach doesn't need them and health chat should carry the
 * minimum context (TEAM_CONTRACT data-minimisation).
 */
export interface CoachChatInput {
  date: string
  /** The user's chat message (or plan-regeneration instruction). */
  message: string
  energy: EnergyResult
  plan: DayPlan
}

export interface AiServices {
  recognizeIngredients(image: UploadedImage): Promise<IngredientRecognitionResult>
  generateNutrition(input: NutritionGenerationInput): Promise<NutritionPlan>
  /** Vision extraction of lab metrics from a report image. */
  extractReportMetrics(image: UploadedImage): Promise<ReportExtractionResult>
  /**
   * A text-free recommendation blueprint (action codes + confirmed metric ids
   * only). The route renders the user-visible HealthRecommendationSet from the
   * persisted confirmed report and fixed templates, so provider text is never
   * shown. Grounding is validated server-side; a phantom citation is dropped.
   */
  generateHealthRecommendations(
    input: HealthRecommendationInput
  ): Promise<HealthRecommendationBlueprint>
  /**
   * Conversational coach reply grounded in the user's own check-in and plan.
   * Implementations must degrade to the deterministic plan-based reply
   * (never throw) so chat and plan regeneration keep working offline.
   */
  generateCoachReply(input: CoachChatInput): Promise<CoachReply>
}

export interface VisionConfig {
  enabled: boolean
  provider: string
  geminiApiKey?: string
  geminiModel: string
}
