import {
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureNutritionPlan,
  fixtureTasks,
  EnergyEngine,
  mergeRegeneratedPlan,
  updatePlanBlock as applyPlanBlockUpdate,
  type AkesoService,
  type CheckInInput,
  type CoachReply,
  type DayPlan,
  type EnergyResult,
  type NutritionPlan,
  type Task,
  type UpdatePlanBlockInput,
  type UserProfile,
} from '@akeso/domain'

const LATENCY_MS = 450

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Demo-only in-memory service.  It delegates all score calculation to the
 * shared deterministic engine so UI fixtures never carry a second set of
 * scoring weights.  Production API requests use this same engine server-side.
 */
const energyEngine = new EnergyEngine()

export class FixtureService implements AkesoService {
  private profile: UserProfile | null = null
  private energy: EnergyResult | null = null
  private plan: DayPlan | null = null

  constructor(private readonly latencyMs = LATENCY_MS) {}

  async getProfile(): Promise<UserProfile | null> {
    await wait(this.latencyMs / 3)
    return this.profile
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await wait(this.latencyMs / 3)
    this.profile = profile
    return profile
  }

  async submitCheckIn(input: CheckInInput): Promise<EnergyResult> {
    await wait(this.latencyMs * 2)
    this.energy = energyEngine.evaluate(input)
    return this.energy
  }

  async getTodayEnergy(date: string): Promise<EnergyResult | null> {
    await wait(this.latencyMs / 3)
    return this.energy && this.energy.date === date ? this.energy : null
  }

  async getTasks(_date: string): Promise<Task[]> {
    await wait(this.latencyMs / 2)
    return fixtureTasks
  }

  async getTodayPlan(date: string): Promise<DayPlan | null> {
    await wait(this.latencyMs)
    if (!this.energy) return null
    if (!this.plan || this.plan.date !== date) {
      this.plan = { ...fixtureDayPlan, date }
    }
    return this.plan
  }

  async updatePlanBlock(
    date: string,
    blockId: string,
    input: UpdatePlanBlockInput
  ): Promise<DayPlan> {
    await wait(this.latencyMs)
    const plan = await this.getTodayPlan(date)
    if (!plan) throw new Error(`No plan exists for ${date}`)
    this.plan = applyPlanBlockUpdate(plan, blockId, input)
    return this.plan
  }

  async regeneratePlan(
    date: string,
    _instruction?: string
  ): Promise<{ plan: DayPlan; coach: CoachReply }> {
    await wait(this.latencyMs * 3)
    const freshPlan: DayPlan = {
      ...fixtureDayPlan,
      date,
      generatedAt: new Date().toISOString(),
      coachNote:
        'Plan refreshed: same protected morning peak, with the afternoon rebalanced around your current stress level.',
    }
    this.plan = this.plan
      ? mergeRegeneratedPlan(freshPlan, this.plan)
      : freshPlan
    return {
      plan: this.plan,
      coach: fixtureCoachReply,
    }
  }

  async getNutritionPlan(date: string): Promise<NutritionPlan | null> {
    await wait(this.latencyMs)
    return { ...fixtureNutritionPlan, date }
  }

  async getCoachReply(_date: string): Promise<CoachReply> {
    await wait(this.latencyMs)
    return fixtureCoachReply
  }
}
