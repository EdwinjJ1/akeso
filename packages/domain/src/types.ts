/**
 * Akeso domain types.
 *
 * The App/API/AI shared shapes live in `@akeso/contracts` (Issue #6 — FROZEN,
 * with Zod runtime validation) and are re-exported here so existing
 * `@akeso/domain` imports keep working. Only domain-specific types that have
 * not graduated into the contract yet are defined in this file. Changing any
 * re-exported shape requires sign-off from all module owners
 * (see docs/TEAM_CONTRACT.md §2).
 */

export type {
  ApiError,
  ApiResponse,
  CaffeineIntake,
  CheckInInput,
  CoachReply,
  CoachSuggestion,
  DayPlan,
  EnergyBand,
  EnergyCurvePoint,
  EnergyDemand,
  EnergyFactor,
  EnergyFactorKey,
  EnergyResult,
  HourWindow,
  PlanBlock,
  PlanBlockType,
  Scale1to5,
  Task,
  TaskPriority,
  TaskStatus,
} from '@akeso/contracts'

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
