import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  FridgeItem,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

export interface ProfileRepo {
  get(userId: string): Promise<UserProfile | null>
  upsert(userId: string, profile: UserProfile): Promise<UserProfile>
}

export interface CheckinRepo {
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

export interface Repos {
  profile: ProfileRepo
  checkins: CheckinRepo
  energy: EnergyRepo
  tasks: TaskRepo
  plans: PlanRepo
  fridge: FridgeRepo
  reminders: ReminderRepo
}
