/**
 * Runtime validators, re-exported from `@akeso/contracts` under the
 * camelCase names existing `@akeso/domain` consumers already import.
 *
 * There is deliberately no local schema in this file: @akeso/contracts is
 * the single source of truth for every shape that crosses a process
 * boundary, and a hand-maintained copy here already drifted once (the
 * calendar-date check existed only on the domain side). ZodError comes from
 * the same package so `instanceof` checks match the class that actually
 * throws — each workspace package gets its own physical zod copy (Expo's
 * CLI pins zod v3), so importing `zod` directly here would resolve to a
 * different class.
 */
export {
  BatchFridgeItemsRequestSchema as batchFridgeItemsRequestSchema,
  ZodError,
  CheckInInputSchema as checkInInputSchema,
  DateStringSchema as localDateSchema,
  DietarySafetyProfileSchema as dietarySafetyProfileSchema,
  DietaryPreferenceSchema as dietaryPreferenceSchema,
  FoodAllergenSchema as foodAllergenSchema,
  FridgeItemParamsSchema as fridgeItemParamsSchema,
  FridgeItemSchema as fridgeItemSchema,
  HydrationSchema as hydrationSchema,
  IngredientRecognitionResultSchema as ingredientRecognitionResultSchema,
  LastMealTimingSchema as lastMealTimingSchema,
  PutFridgeItemBodySchema as putFridgeItemBodySchema,
  PatchFridgeItemBodySchema as patchFridgeItemBodySchema,
  NutritionPlanSchema as nutritionPlanSchema,
  RegeneratePlanBodySchema as regeneratePlanBodySchema,
  ReminderPreferenceSchema as reminderPreferenceSchema,
  Scale1to5Schema as scale1to5Schema,
  SleepDurationSchema as sleepDurationSchema,
  UpdatePlanBlockInputSchema as updatePlanBlockInputSchema,
  UpdatePlanBlockParamsSchema as updatePlanBlockParamsSchema,
  UserGoalSchema as userGoalSchema,
  UserProfileSchema as userProfileSchema,
} from '@akeso/contracts'
