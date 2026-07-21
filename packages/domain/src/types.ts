/**
 * Akeso domain types.
 *
 * Every App/API/AI shared shape lives in `@akeso/contracts` (Issue #6 —
 * FROZEN, with Zod runtime validation) and is re-exported here so existing
 * `@akeso/domain` imports keep working. Changing any re-exported shape
 * requires sign-off from all module owners (see docs/TEAM_CONTRACT.md §2).
 */

export type {
  ApiError,
  ApiResponse,
  CheckInInput,
  CoachReply,
  CoachSuggestion,
  DayPlan,
  DietaryPreference,
  EnergyBand,
  EnergyCurvePoint,
  EnergyDemand,
  EnergyFactor,
  EnergyFactorKey,
  EnergyFactorRole,
  EnergyResult,
  FridgeCategory,
  FridgeItem,
  HourWindow,
  Hydration,
  LastMealTiming,
  MealRecommendation,
  MealSlot,
  NutrientKey,
  NutrientNeed,
  NutritionPlan,
  PlanBlock,
  PlanBlockType,
  ReminderPreference,
  Scale1to5,
  SleepDuration,
  Task,
  TaskPriority,
  TaskStatus,
  UserGoal,
  UserProfile,
} from '@akeso/contracts'
