import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
  Task,
  UserProfile,
} from './types'

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
  getCoachReply(date: string): Promise<CoachReply>
}
