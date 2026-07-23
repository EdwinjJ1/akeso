import type {
  CheckInInput,
  CoachReply,
  CreateReportRequest,
  DayPlan,
  EnergyCalibration,
  EnergyResult,
  FridgeItem,
  HealthReport,
  HealthRecommendationSet,
  IngredientRecognitionResult,
  NutritionPlan,
  ReminderPreference,
  ReportExtractionResult,
  Task,
  UpdatePlanBlockInput,
  UpdateReportMetricsRequest,
  UpdateReportRequest,
  UserProfile,
} from './types'

export interface FridgeImageUpload {
  uri: string
  filename: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

/** Report uploads are JPEG/PNG only for the MVP (no PDF). */
export interface ReportImageUpload {
  uri: string
  filename: string
  mimeType: 'image/jpeg' | 'image/png'
}

/**
 * The single seam between the app and the backend.
 *
 * The app only ever talks to this interface. During UI development it is
 * backed by a FixtureService; at integration time it is swapped for an
 * ApiService hitting the Express API. Both implementations MUST return
 * identical shapes — screens never change when the swap happens.
 *
 * Each method maps 1:1 to an API endpoint (see docs/API_CONTRACT.md).
 */
export interface AkesoService {
  getProfile(): Promise<UserProfile | null>
  saveProfile(profile: UserProfile): Promise<UserProfile>

  /** POST /v1/checkins → EnergyEngine runs server-side, returns the result */
  submitCheckIn(input: CheckInInput): Promise<EnergyResult>
  /** GET /v1/energy/:date — null when the user has not checked in yet */
  getTodayEnergy(date: string): Promise<EnergyResult | null>
  /** GET /v1/energy/:date/replay — read-only replay under the stored version */
  replayEnergy(date: string): Promise<EnergyResult>
  /** PUT /v1/energy/:date/calibration — affects future baselines only */
  saveEnergyCalibration(
    date: string,
    actualEnergy: 1 | 2 | 3 | 4 | 5
  ): Promise<EnergyCalibration>

  getTasks(date: string): Promise<Task[]>
  /** GET /v1/plan/:date — null until an energy result exists */
  getTodayPlan(date: string): Promise<DayPlan | null>
  /** PATCH /v1/plan/:date/blocks/:blockId — updates only user-editable fields */
  updatePlanBlock(
    date: string,
    blockId: string,
    input: UpdatePlanBlockInput
  ): Promise<DayPlan>
  /** POST /v1/plan/:date/regenerate — optional free-text instruction to the coach */
  regeneratePlan(
    date: string,
    instruction?: string
  ): Promise<{ plan: DayPlan; coach: CoachReply }>

  getNutritionPlan(date: string): Promise<NutritionPlan | null>
  regenerateNutrition(date: string): Promise<NutritionPlan>
  getCoachReply(date: string): Promise<CoachReply>

  /**
   * GET /v1/fridge · PUT /v1/fridge/:id · DELETE /v1/fridge/:id
   *
   * Not wired into any screen yet (Nutrition's fridge list is still the
   * read-only fixture view) — persisted ahead of the editing UI so the data
   * layer isn't a blocker whenever that ships.
   */
  getFridgeItems(): Promise<FridgeItem[]>
  /** Upsert by `item.id` — same id twice overwrites, so retries are safe. */
  saveFridgeItem(item: FridgeItem): Promise<FridgeItem>
  deleteFridgeItem(id: string): Promise<void>
  saveFridgeItemsBatch(items: FridgeItem[]): Promise<FridgeItem[]>
  recognizeFridgeImage(image: FridgeImageUpload): Promise<IngredientRecognitionResult>

  /**
   * Health reports (More tab). Extraction returns editable candidates only —
   * nothing is stored until saveReport persists the reviewed fields. Saved
   * unconfirmed fields remain correctable, while recommendations reference
   * confirmed metric ids only and always carry a non-diagnostic disclaimer.
   */
  extractReportMetrics(image: ReportImageUpload): Promise<ReportExtractionResult>
  getReports(): Promise<HealthReport[]>
  getReport(id: string): Promise<HealthReport>
  /** POST /v1/reports — server assigns the id and recomputes each status. */
  saveReport(input: CreateReportRequest): Promise<HealthReport>
  /** PATCH /v1/reports/:id — updates user-editable report metadata only. */
  updateReport(id: string, input: UpdateReportRequest): Promise<HealthReport>
  /** PATCH /v1/reports/:id/metrics — replaces the reviewed metric set. */
  updateReportMetrics(
    id: string,
    input: UpdateReportMetricsRequest
  ): Promise<HealthReport>
  deleteReport(id: string): Promise<void>
  getReportRecommendations(id: string): Promise<HealthRecommendationSet>
  regenerateReportRecommendations(id: string): Promise<HealthRecommendationSet>

  /** GET /v1/reminders — null until the user has set a preference */
  getReminderPreference(): Promise<ReminderPreference | null>
  /** PUT /v1/reminders */
  saveReminderPreference(pref: ReminderPreference): Promise<ReminderPreference>
}
