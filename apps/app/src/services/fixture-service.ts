import {
  buildInventoryNutritionFallback,
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureTasks,
  filterNutritionPlanForDietarySafety,
  EnergyEngine,
  type AkesoService,
  type CheckInInput,
  type CoachReply,
  type DayPlan,
  type EnergyResult,
  type FridgeImageUpload,
  type FridgeItem,
  type IngredientRecognitionResult,
  type NutritionPlan,
  type ReminderPreference,
  type Task,
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
  private fridge = new Map<string, FridgeItem>()
  private reminder: ReminderPreference | null = null

  async getProfile(): Promise<UserProfile | null> {
    await wait(LATENCY_MS / 3)
    return this.profile
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await wait(LATENCY_MS / 3)
    this.profile = profile
    return profile
  }

  async submitCheckIn(input: CheckInInput): Promise<EnergyResult> {
    await wait(LATENCY_MS * 2)
    this.energy = energyEngine.evaluate(input)
    return this.energy
  }

  async getTodayEnergy(date: string): Promise<EnergyResult | null> {
    await wait(LATENCY_MS / 3)
    return this.energy && this.energy.date === date ? this.energy : null
  }

  async getTasks(_date: string): Promise<Task[]> {
    await wait(LATENCY_MS / 2)
    return fixtureTasks
  }

  async getTodayPlan(date: string): Promise<DayPlan | null> {
    await wait(LATENCY_MS)
    return this.energy && this.energy.date === date ? { ...fixtureDayPlan, date } : null
  }

  async regeneratePlan(
    date: string,
    _instruction?: string
  ): Promise<{ plan: DayPlan; coach: CoachReply }> {
    await wait(LATENCY_MS * 3)
    return {
      plan: {
        ...fixtureDayPlan,
        date,
        generatedAt: new Date().toISOString(),
        coachNote:
          'Plan refreshed: same protected morning peak, with the afternoon rebalanced around your current stress level.',
      },
      coach: fixtureCoachReply,
    }
  }

  private buildNutrition(date: string): NutritionPlan {
    const plan = buildInventoryNutritionFallback({
      date,
      fridge: Array.from(this.fridge.values()),
      energyBand: this.energy?.band ?? 'moderate',
      dietaryPreference: this.profile?.dietaryPreference ?? 'none',
      needs: [],
    })
    return filterNutritionPlanForDietarySafety(plan, this.profile?.dietarySafety)
  }

  async getNutritionPlan(date: string): Promise<NutritionPlan | null> {
    await wait(LATENCY_MS)
    return this.buildNutrition(date)
  }

  async regenerateNutrition(date: string): Promise<NutritionPlan> {
    await wait(LATENCY_MS)
    return this.buildNutrition(date)
  }

  async getCoachReply(_date: string): Promise<CoachReply> {
    await wait(LATENCY_MS)
    return fixtureCoachReply
  }

  async getFridgeItems(): Promise<FridgeItem[]> {
    await wait(LATENCY_MS / 3)
    return Array.from(this.fridge.values())
  }

  async saveFridgeItem(item: FridgeItem): Promise<FridgeItem> {
    await wait(LATENCY_MS / 3)
    this.fridge.set(item.id, item)
    return item
  }

  async deleteFridgeItem(id: string): Promise<void> {
    await wait(LATENCY_MS / 3)
    this.fridge.delete(id)
  }

  async saveFridgeItemsBatch(items: FridgeItem[]): Promise<FridgeItem[]> {
    await wait(LATENCY_MS / 3)
    items.forEach((item) => this.fridge.set(item.id, item))
    return items
  }

  async recognizeFridgeImage(
    _image: FridgeImageUpload
  ): Promise<IngredientRecognitionResult> {
    throw new Error(
      'Live fridge recognition requires EXPO_PUBLIC_API_URL. Manual entry is available.'
    )
  }

  async getReminderPreference(): Promise<ReminderPreference | null> {
    await wait(LATENCY_MS / 3)
    return this.reminder
  }

  async saveReminderPreference(pref: ReminderPreference): Promise<ReminderPreference> {
    await wait(LATENCY_MS / 3)
    this.reminder = pref
    return pref
  }
}
