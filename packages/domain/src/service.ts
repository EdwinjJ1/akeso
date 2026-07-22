import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  FridgeItem,
  IngredientRecognitionResult,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from './types'

export interface FridgeImageUpload {
  uri: string
  filename: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
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

  getTasks(date: string): Promise<Task[]>
  /** GET /v1/plan/:date — null until an energy result exists */
  getTodayPlan(date: string): Promise<DayPlan | null>
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

  /** GET /v1/reminders — null until the user has set a preference */
  getReminderPreference(): Promise<ReminderPreference | null>
  /** PUT /v1/reminders */
  saveReminderPreference(pref: ReminderPreference): Promise<ReminderPreference>
}
