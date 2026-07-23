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
  CreateReportRequestSchema as createReportRequestSchema,
  DateStringSchema as localDateSchema,
  DietarySafetyProfileSchema as dietarySafetyProfileSchema,
  DetectedReportMetricSchema as detectedReportMetricSchema,
  DietaryPreferenceSchema as dietaryPreferenceSchema,
  FoodAllergenSchema as foodAllergenSchema,
  FridgeItemParamsSchema as fridgeItemParamsSchema,
  FridgeItemSchema as fridgeItemSchema,
  HealthReportSchema as healthReportSchema,
  HealthRecommendationProfileContextSchema as healthRecommendationProfileContextSchema,
  HealthRecommendationSchema as healthRecommendationSchema,
  HealthRecommendationSetSchema as healthRecommendationSetSchema,
  HealthRecommendationBlueprintSchema as healthRecommendationBlueprintSchema,
  RecommendationActionCodeSchema as recommendationActionCodeSchema,
  HydrationSchema as hydrationSchema,
  IngredientRecognitionResultSchema as ingredientRecognitionResultSchema,
  LastMealTimingSchema as lastMealTimingSchema,
  PutFridgeItemBodySchema as putFridgeItemBodySchema,
  PatchFridgeItemBodySchema as patchFridgeItemBodySchema,
  NutritionPlanSchema as nutritionPlanSchema,
  RegeneratePlanBodySchema as regeneratePlanBodySchema,
  ReminderPreferenceSchema as reminderPreferenceSchema,
  ReportExtractionResultSchema as reportExtractionResultSchema,
  ReportMetricSchema as reportMetricSchema,
  ReportMetricStatusSchema as reportMetricStatusSchema,
  UpdateReportMetricsRequestSchema as updateReportMetricsRequestSchema,
  UpdateReportRequestSchema as updateReportRequestSchema,
  ReportParamsSchema as reportParamsSchema,
  Scale1to5Schema as scale1to5Schema,
  SleepDurationSchema as sleepDurationSchema,
  UpdatePlanBlockInputSchema as updatePlanBlockInputSchema,
  UpdatePlanBlockParamsSchema as updatePlanBlockParamsSchema,
  UserGoalSchema as userGoalSchema,
  UserProfileSchema as userProfileSchema,
} from '@akeso/contracts'
