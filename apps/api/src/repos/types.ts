import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  PlanBlock,
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
  updateBlock(userId: string, date: string, block: PlanBlock): Promise<void>
}

export interface Repos {
  profile: ProfileRepo
  checkins: CheckinRepo
  energy: EnergyRepo
  tasks: TaskRepo
  plans: PlanRepo
}
