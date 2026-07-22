import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  PlanBlock,
  FridgeItem,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

export interface ProfileRepo {
  get(userId: string): Promise<UserProfile | null>
  upsert(userId: string, profile: UserProfile): Promise<UserProfile>
}

export interface CheckinRepo {
  get(userId: string, date: string): Promise<CheckInInput | null>
  upsert(userId: string, input: CheckInInput): Promise<void>
}

export interface EnergyRepo {
  get(userId: string, date: string): Promise<EnergyResult | null>
  upsert(userId: string, result: EnergyResult): Promise<EnergyResult>
}

export interface TaskRepo {
  list(userId: string, date: string): Promise<Task[]>
}

export interface PlanRepo {
  get(userId: string, date: string): Promise<DayPlan | null>
  upsert(userId: string, plan: DayPlan): Promise<DayPlan>
  updateBlock(userId: string, date: string, block: PlanBlock): Promise<void>
}

export interface FridgeRepo {
  list(userId: string): Promise<FridgeItem[]>
  /** Upsert by `item.id` — same id twice overwrites, so retries are safe. */
  upsert(userId: string, item: FridgeItem): Promise<FridgeItem>
  /** Idempotent: removing an id that doesn't exist (or never did) is not an error. */
  remove(userId: string, id: string): Promise<void>
}

export interface ReminderRepo {
  get(userId: string): Promise<ReminderPreference | null>
  upsert(userId: string, pref: ReminderPreference): Promise<ReminderPreference>
}

export interface NutritionPlanCacheRepo {
  get(userId: string, cacheKey: string): Promise<NutritionPlan | null>
  upsert(userId: string, cacheKey: string, plan: NutritionPlan): Promise<void>
}

export interface Repos {
  profile: ProfileRepo
  checkins: CheckinRepo
  energy: EnergyRepo
  tasks: TaskRepo
  plans: PlanRepo
  fridge: FridgeRepo
  nutritionPlanCache: NutritionPlanCacheRepo
  reminders: ReminderRepo
}
