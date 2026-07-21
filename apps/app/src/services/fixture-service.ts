import {
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureNutritionPlan,
  fixtureTasks,
  EnergyEngine,
  type AkesoService,
  type CheckInInput,
  type CoachReply,
  type DayPlan,
  type EnergyResult,
  type NutritionPlan,
  type Task,
  type UserProfile,
} from '@akeso/domain'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LATENCY_MS = 450
const CHECK_INS_KEY = 'akeso:check-ins'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const loadCheckIns = async () => {
  const stored = await AsyncStorage.getItem(CHECK_INS_KEY)
  return stored ? (JSON.parse(stored) as Record<string, CheckInInput>) : {}
}

/**
 * Demo-only in-memory service.  It delegates all score calculation to the
 * shared deterministic engine so UI fixtures never carry a second set of
 * scoring weights.  Production API requests use this same engine server-side.
 */
const energyEngine = new EnergyEngine()

export class FixtureService implements AkesoService {
  private profile: UserProfile | null = null
  private energy: EnergyResult | null = null

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
    const checkIns = await loadCheckIns()
    checkIns[input.date] = { ...input }
    await AsyncStorage.setItem(CHECK_INS_KEY, JSON.stringify(checkIns))
    this.energy = energyEngine.evaluate(input)
    return this.energy
  }

  async getLatestCheckIn(date: string): Promise<CheckInInput | null> {
    await wait(LATENCY_MS / 3)
    const checkIns = await loadCheckIns()
    const latestDate = Object.keys(checkIns)
      .filter((checkInDate) => checkInDate <= date)
      .sort((left, right) => right.localeCompare(left))[0]
    const latest = latestDate ? checkIns[latestDate] : undefined
    return latest ? { ...latest } : null
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
    return this.energy ? { ...fixtureDayPlan, date } : null
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

  async getNutritionPlan(date: string): Promise<NutritionPlan | null> {
    await wait(LATENCY_MS)
    return { ...fixtureNutritionPlan, date }
  }

  async getCoachReply(_date: string): Promise<CoachReply> {
    await wait(LATENCY_MS)
    return fixtureCoachReply
  }
}
