import {
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureEnergyResult,
  fixtureNutritionPlan,
  fixtureTasks,
  type AkesoService,
  type CheckInInput,
  type CoachReply,
  type DayPlan,
  type EnergyBand,
  type EnergyFactor,
  type EnergyResult,
  type NutritionPlan,
  type Task,
  type UserProfile,
} from '@akeso/domain'

const LATENCY_MS = 450

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * FIXTURE ONLY — throwaway scoring so the demo reacts to what you enter.
 * The authoritative EnergyEngine is built by the Domain owner and runs
 * behind the API; this file is deleted at integration time.
 */
function scoreCheckIn(input: CheckInInput): EnergyResult {
  const factors: EnergyFactor[] = []

  const sleepImpact = clamp(Math.round((input.sleepHours - 5.5) * 6), -20, 18)
  factors.push({
    key: 'sleep_duration',
    label: `${input.sleepHours}h sleep`,
    impact: sleepImpact,
    explanation:
      sleepImpact >= 0
        ? 'Close to your 8h target — your biggest energy source today.'
        : 'Short sleep is the main drag on today’s score.',
  })

  const qualityImpact = (input.sleepQuality - 3) * 4
  factors.push({
    key: 'sleep_quality',
    label: `Sleep quality ${input.sleepQuality}/5`,
    impact: qualityImpact,
    explanation:
      qualityImpact >= 0
        ? 'Restful sleep lifts your morning peak.'
        : 'Broken sleep lowers your morning peak.',
  })

  const stressImpact = (3 - input.stress) * 5
  factors.push({
    key: 'stress',
    label: `Stress ${input.stress}/5`,
    impact: stressImpact,
    explanation:
      stressImpact >= 0
        ? 'Low stress keeps your afternoon dip shallow.'
        : 'Higher stress tends to deepen your afternoon dip.',
  })

  const moodImpact = (input.mood - 3) * 3
  factors.push({
    key: 'mood',
    label: `Mood ${input.mood}/5`,
    impact: moodImpact,
    explanation:
      moodImpact >= 0
        ? 'Positive mood adds steady energy across the day.'
        : 'Low mood can flatten the whole curve a little.',
  })

  const caffeineImpact =
    input.caffeine === 'evening' ? -6 : input.caffeine === 'afternoon' ? -3 : 0
  if (input.caffeine !== 'none') {
    const caffeineLabel =
      input.caffeine.charAt(0).toUpperCase() + input.caffeine.slice(1)
    factors.push({
      key: 'caffeine',
      label: `${caffeineLabel} caffeine`,
      impact: caffeineImpact,
      explanation:
        caffeineImpact < 0
          ? 'Late caffeine can push tonight’s sleep later.'
          : 'Morning caffeine has little cost to tonight’s sleep.',
    })
  }

  const selfImpact = (input.energyNow - 3) * 4
  factors.push({
    key: 'self_report',
    label: `Feels like ${input.energyNow}/5`,
    impact: selfImpact,
    explanation: 'How you feel right now nudges the whole prediction.',
  })

  const score = clamp(
    50 + factors.reduce((sum, factor) => sum + factor.impact, 0),
    5,
    98
  )
  const band: EnergyBand = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low'

  const curve = fixtureEnergyResult.curve.map((point) => ({
    hour: point.hour,
    level: clamp(Math.round(point.level * (score / 72)), 5, 100),
  }))

  const headline =
    band === 'high'
      ? 'Solid morning ahead — protect 9:00–11:30 for deep work.'
      : band === 'moderate'
        ? 'A steady day — schedule one hard task in the late morning.'
        : 'Low battery today — plan light work and real recovery.'

  return {
    ...fixtureEnergyResult,
    date: input.date,
    score,
    band,
    headline,
    factors: factors.filter((factor) => factor.impact !== 0),
    curve,
    computedAt: new Date().toISOString(),
  }
}

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
    this.energy = scoreCheckIn(input)
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
