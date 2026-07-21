/**
 * Akeso shared contract (Issue #6 — FROZEN once agreed).
 *
 * Every fixture and every real API response MUST match these shapes exactly.
 * Changing anything here requires sign-off from all module owners
 * (see docs/TEAM_CONTRACT.md §2).
 */

export type Scale1to5 = 1 | 2 | 3 | 4 | 5

// ── Check-in ────────────────────────────────────────────────────────────────

/** Bucketed hours of sleep last night. */
export type SleepDuration =
  | 'under_5h'
  | '5_6h'
  | '6_7h'
  | '7_8h'
  | '8_9h'
  | 'over_9h'
  | 'not_sure'

/** How long ago the last meal was. */
export type LastMealTiming =
  | 'within_1h'
  | '1_3h'
  | '3_5h'
  | 'over_5h'
  | 'not_today'
  | 'not_sure'

/** Rough water intake so far today, in litre bands. */
export type Hydration =
  | 'under_0_5l'
  | '0_5_1l'
  | '1_1_5l'
  | '1_5_2l'
  | 'over_2l'
  | 'not_sure'

export interface CheckInInput {
  /** Local date, YYYY-MM-DD */
  date: string
  /** Self-reported energy right now; 1..5 maps to 20/40/60/80/100. */
  reportedEnergy: Scale1to5
  sleepDuration: SleepDuration
  lastMealTiming: LastMealTiming
  /** Optional free-text description of the last meal. */
  lastMealDescription?: string
  hydration: Hydration
}

// ── Energy ──────────────────────────────────────────────────────────────────

export type EnergyBand = 'low' | 'moderate' | 'high'

export type EnergyFactorKey =
  | 'reported_energy'
  | 'sleep_duration'
  | 'last_meal'
  | 'hydration'

/**
 * Whether a factor actually drove the score (`reported_energy`) or is only
 * shown as possible context. Sleep, last meal and hydration are context: they
 * are never forced into a point attribution.
 */
export type EnergyFactorRole = 'reported_energy' | 'possible_context'

export interface EnergyFactor {
  key: EnergyFactorKey
  label: string
  role: EnergyFactorRole
  /**
   * Signed points this factor contributed to the score. Only set for the
   * `reported_energy` factor; `possible_context` factors are informational
   * and deliberately carry no attribution.
   */
  impact?: number
  explanation: string
}

export interface EnergyCurvePoint {
  /** 0–23 */
  hour: number
  /** 0–100 predicted energy */
  level: number
}

export interface HourWindow {
  startHour: number
  endHour: number
}

export interface EnergyResult {
  date: string
  /** 0–100, computed by the deterministic EnergyEngine only */
  score: number
  band: EnergyBand
  /** One-line human summary, e.g. "Solid morning ahead — protect 9–11am." */
  headline: string
  factors: EnergyFactor[]
  curve: EnergyCurvePoint[]
  peakWindow: HourWindow
  dipWindow: HourWindow
  /** ISO datetime */
  computedAt: string
}

// ── Tasks & plan ────────────────────────────────────────────────────────────

export type TaskPriority = 'must' | 'should' | 'could'
export type EnergyDemand = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'scheduled' | 'done'

export interface Task {
  id: string
  title: string
  priority: TaskPriority
  energyDemand: EnergyDemand
  estimatedMinutes: number
  status: TaskStatus
}

export type PlanBlockType = 'focus' | 'light' | 'break' | 'meal' | 'recovery'

export interface PlanBlock {
  id: string
  /** HH:mm, 24h local */
  start: string
  /** HH:mm, 24h local */
  end: string
  type: PlanBlockType
  title: string
  taskId?: string
  /** Predicted energy band during this block */
  energyLevel: EnergyBand
  /** Why the planner put it here — always evidence-based */
  rationale: string
}

export interface DayPlan {
  date: string
  blocks: PlanBlock[]
  coachNote: string
  /** ISO datetime */
  generatedAt: string
}

// ── Coach ───────────────────────────────────────────────────────────────────

export interface CoachSuggestion {
  id: string
  title: string
  detail: string
  /** Evidence: factor keys or plan block ids this is based on */
  basedOn: string[]
}

export interface CoachReply {
  message: string
  suggestions: CoachSuggestion[]
  adjustedPlan?: DayPlan
  /** Non-clinical disclaimer — must always be shown with coach output */
  disclaimer: string
}

// ── Nutrition ───────────────────────────────────────────────────────────────

export type NutrientKey =
  | 'protein'
  | 'complex_carbs'
  | 'iron'
  | 'vitamin_c'
  | 'omega3'
  | 'hydration'
  | 'fiber'

export interface NutrientNeed {
  key: NutrientKey
  label: string
  current: number
  target: number
  unit: string
  note?: string
}

export type FridgeCategory =
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'grain'
  | 'other'

export interface FridgeItem {
  id: string
  name: string
  category: FridgeCategory
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealRecommendation {
  id: string
  slot: MealSlot
  title: string
  description: string
  usesFridgeItemIds: string[]
  boosts: NutrientKey[]
  prepMinutes: number
  tags: string[]
}

export interface NutritionPlan {
  date: string
  needs: NutrientNeed[]
  fridge: FridgeItem[]
  meals: MealRecommendation[]
  /** Ties recommendations back to today's energy factors */
  rationale: string
}

// ── User & onboarding ───────────────────────────────────────────────────────

export type UserGoal = 'academic' | 'work' | 'fitness' | 'balance'

export type DietaryPreference =
  | 'none'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'gluten_free'

export interface UserProfile {
  displayName: string
  goal: UserGoal
  /** HH:mm */
  typicalWake: string
  /** HH:mm */
  typicalSleep: string
  dietaryPreference: DietaryPreference
}

// ── API envelope ────────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}
