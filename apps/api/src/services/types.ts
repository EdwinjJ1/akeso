import type {
  CheckInInput,
  CoachChatIntent,
  CoachChatTurn,
  CoachReply,
  ContextNote,
  DayPlan,
  Task,
  EnergyResult,
  FridgeItem,
  HealthReport,
  HealthRecommendationBlueprint,
  HealthRecommendationProfileContext,
  IngredientRecognitionResult,
  NutritionPlan,
  ReportChatReply,
  ReportChatTurn,
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
 * Everything the chat coach may see: the user's message and history plus
 * their own persisted data for the day. This is deliberately the user's
 * whole picture — check-in, energy (including any manual score adjustment),
 * plan, profile, fridge, CONFIRMED health-report metrics, and their "Tell
 * Akeso more" notes — so the coach can answer like it actually knows them.
 *
 * Privacy trade-off, decided by the product owner: unlike the
 * recommendation path's opaque metric_N refs, chat sends confirmed metric
 * names/values to the provider — that is what makes "it really knows my
 * data" possible. Unconfirmed metrics are filtered out by the route and
 * must never appear here.
 */
export interface CoachChatInput {
  date: string
  /** The user's chat message ('' only when intent is 'opener'). */
  message: string
  /** Most recent turns, oldest first. */
  history: CoachChatTurn[]
  intent: CoachChatIntent
  energy: EnergyResult
  /** Null when the day has no plan yet — chat must still work. */
  plan: DayPlan | null
  profile: UserProfile | null
  checkin: CheckInInput | null
  fridge: FridgeItem[]
  /** Saved reports with UNCONFIRMED METRICS ALREADY REMOVED by the route. */
  reports: HealthReport[]
  contextNotes: ContextNote[]
}

/**
 * Everything the nutritionist chat may see: the user's message and recent
 * turns, their report restricted to confirmed metrics, and the strict
 * profile allowlist (no names or free-text profile fields).
 */
export interface ReportNutritionChatInput {
  message: string
  history: ReportChatTurn[]
  /** Must already be filtered to confirmed metrics by the caller. */
  report: HealthReport
  profile: HealthRecommendationProfileContext | null
}

/**
 * Inputs for AI day-plan generation. The user's regeneration instruction is
 * passed to the model (never string-appended to output text), and their
 * "Tell Akeso more" notes let the plan react to mood/stress/food context.
 */
export interface PlanGenerationInput {
  date: string
  energy: EnergyResult
  tasks: Task[]
  profile: UserProfile | null
  contextNotes: ContextNote[]
  instruction?: string
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
  /**
   * An AI-generated day plan grounded in the user's energy shape, real
   * tasks, and notes. Implementations must degrade to the deterministic
   * planDay scheduler (never throw) so plans keep working offline; every
   * blueprint is validated server-side before it becomes a DayPlan.
   */
  generatePlan(input: PlanGenerationInput): Promise<DayPlan>
  /**
   * Nutritionist chat reply grounded in the user's confirmed report metrics.
   * Implementations must degrade to the honest unavailable reply (never
   * throw), and the reference-only disclaimer is always server-attached.
   */
  generateReportChatReply(
    input: ReportNutritionChatInput
  ): Promise<ReportChatReply>
}

export interface VisionConfig {
  enabled: boolean
  provider: string
  geminiApiKey?: string
  geminiModel: string
}
