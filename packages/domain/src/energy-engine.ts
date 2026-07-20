import type {
  CheckInInput,
  EnergyBand,
  EnergyCurvePoint,
  EnergyFactor,
  EnergyResult,
  HourWindow,
} from './types.js'

/**
 * The score-only portion of an EnergyResult.  Keeping this as a derived type
 * means the engine cannot drift from the shared API contract.
 */
export type EnergyScore = Pick<
  EnergyResult,
  'date' | 'score' | 'band' | 'headline' | 'factors'
>

type ScaleImpactMap = Readonly<Record<1 | 2 | 3 | 4 | 5, number>>

export interface EnergyEngineConfig {
  readonly baseScore: number
  readonly sleepDuration: readonly {
    readonly minimumHours: number
    readonly impact: number
  }[]
  readonly sleepQuality: ScaleImpactMap
  readonly stress: ScaleImpactMap
  readonly mood: ScaleImpactMap
  readonly selfReport: ScaleImpactMap
  readonly caffeine: Readonly<Record<CheckInInput['caffeine'], number>>
  readonly curveOffsets: readonly {
    readonly hour: number
    readonly offset: number
  }[]
}

/**
 * The sole home for the deterministic scoring rules.  Values are deliberately
 * small and expressed as whole points so a factor's impact always reconciles
 * with the resulting score.
 */
export const ENERGY_ENGINE_CONFIG: EnergyEngineConfig = {
  baseScore: 50,
  sleepDuration: [
    { minimumHours: 8.5, impact: 16 },
    { minimumHours: 8, impact: 14 },
    { minimumHours: 7.5, impact: 11 },
    { minimumHours: 7, impact: 8 },
    { minimumHours: 6, impact: 3 },
    { minimumHours: 5, impact: -5 },
    { minimumHours: 4, impact: -12 },
    { minimumHours: 0, impact: -16 },
  ],
  sleepQuality: { 1: -7, 2: -4, 3: 0, 4: 5, 5: 9 },
  stress: { 1: 8, 2: 4, 3: 0, 4: -5, 5: -9 },
  mood: { 1: -6, 2: -3, 3: 0, 4: 3, 5: 6 },
  selfReport: { 1: -7, 2: -3, 3: 0, 4: 4, 5: 8 },
  caffeine: { none: 0, morning: 2, afternoon: -3, evening: -5 },
  // Morning, midday, afternoon and evening are all represented here.
  curveOffsets: [
    { hour: 7, offset: -31 },
    { hour: 9, offset: 5 },
    { hour: 11, offset: 11 },
    { hour: 13, offset: -2 },
    { hour: 15, offset: -17 },
    { hour: 17, offset: -7 },
    { hour: 19, offset: -10 },
    { hour: 21, offset: -25 },
  ],
}

const SCORE_MIN = 0
const SCORE_MAX = 100
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface NormalizedCheckIn {
  date: string
  sleepHours: number
  sleepQuality: 1 | 2 | 3 | 4 | 5
  mood: 1 | 2 | 3 | 4 | 5
  stress: 1 | 2 | 3 | 4 | 5
  energyNow: 1 | 2 | 3 | 4 | 5
  caffeine: CheckInInput['caffeine']
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const normalizedNumber = (value: number, minimum: number, maximum: number) =>
  Number.isFinite(value) ? clamp(value, minimum, maximum) : minimum

const normalizedScale = (value: number): 1 | 2 | 3 | 4 | 5 =>
  Math.round(normalizedNumber(value, 1, 5)) as 1 | 2 | 3 | 4 | 5

const normalizeCheckIn = (input: CheckInInput): NormalizedCheckIn => ({
  date: input.date,
  sleepHours: normalizedNumber(input.sleepHours, 0, 14),
  sleepQuality: normalizedScale(input.sleepQuality),
  mood: normalizedScale(input.mood),
  stress: normalizedScale(input.stress),
  energyNow: normalizedScale(input.energyNow),
  caffeine: input.caffeine,
})

const formatHours = (hours: number) =>
  Number.isInteger(hours) ? String(hours) : hours.toFixed(1)

const describeImpact = (description: string, impact: number) => {
  if (impact > 0) return `${description} Adds ${impact} points to today's score.`
  if (impact < 0) return `${description} Subtracts ${Math.abs(impact)} points from today's score.`
  return `${description} Does not change today's score.`
}

const energyBandFor = (score: number): EnergyBand => {
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

const sleepDurationImpact = (
  hours: number,
  config: EnergyEngineConfig
): number =>
  config.sleepDuration.find((rule) => hours >= rule.minimumHours)?.impact ??
  config.sleepDuration[config.sleepDuration.length - 1].impact

const deterministicComputedAt = (date: string) =>
  `${DATE_PATTERN.test(date) ? date : '1970-01-01'}T00:00:00.000Z`

const windowAround = (hour: number): HourWindow => ({
  startHour: Math.max(0, hour - 1),
  endHour: Math.min(23, hour + 1),
})

/**
 * Pure, deterministic domain engine.  It has no dependency on time, storage,
 * networking, UI, or generative AI, so the same check-in always gives the
 * same result.
 */
export class EnergyEngine {
  constructor(
    private readonly config: EnergyEngineConfig = ENERGY_ENGINE_CONFIG
  ) {}

  score(input: CheckInInput): EnergyScore {
    const checkIn = normalizeCheckIn(input)
    const durationImpact = sleepDurationImpact(checkIn.sleepHours, this.config)
    const qualityImpact = this.config.sleepQuality[checkIn.sleepQuality]
    const stressImpact = this.config.stress[checkIn.stress]
    const moodImpact = this.config.mood[checkIn.mood]
    const caffeineImpact = this.config.caffeine[checkIn.caffeine]
    const selfReportImpact = this.config.selfReport[checkIn.energyNow]

    const factors: EnergyFactor[] = [
      {
        key: 'sleep_duration',
        label: `${formatHours(checkIn.sleepHours)}h sleep`,
        impact: durationImpact,
        explanation: describeImpact(
          checkIn.sleepHours >= 7.5
            ? 'This amount of sleep supports a stronger start to the day.'
            : 'Short sleep is likely to make the day feel harder.',
          durationImpact
        ),
      },
      {
        key: 'sleep_quality',
        label: `Sleep quality ${checkIn.sleepQuality}/5`,
        impact: qualityImpact,
        explanation: describeImpact(
          checkIn.sleepQuality >= 4
            ? 'Restful sleep supports the morning peak.'
            : 'Interrupted sleep can soften the morning peak.',
          qualityImpact
        ),
      },
      {
        key: 'stress',
        label: `Stress ${checkIn.stress}/5`,
        impact: stressImpact,
        explanation: describeImpact(
          checkIn.stress <= 2
            ? 'Lower stress helps keep the afternoon dip shallow.'
            : 'Higher stress can make the afternoon dip deeper.',
          stressImpact
        ),
      },
      {
        key: 'mood',
        label: `Mood ${checkIn.mood}/5`,
        impact: moodImpact,
        explanation: describeImpact(
          checkIn.mood >= 4
            ? 'A positive mood supports steadier energy.'
            : 'A low mood may flatten energy across the day.',
          moodImpact
        ),
      },
      {
        key: 'caffeine',
        label:
          checkIn.caffeine === 'none'
            ? 'No caffeine'
            : `${checkIn.caffeine[0].toUpperCase()}${checkIn.caffeine.slice(1)} caffeine`,
        impact: caffeineImpact,
        explanation: describeImpact(
          checkIn.caffeine === 'morning'
            ? 'Morning caffeine gives a small near-term lift.'
            : checkIn.caffeine === 'afternoon' || checkIn.caffeine === 'evening'
              ? 'Later caffeine can compromise tonight\'s recovery.'
              : 'Skipping caffeine has no direct score adjustment.',
          caffeineImpact
        ),
      },
      {
        key: 'self_report',
        label: `Energy right now ${checkIn.energyNow}/5`,
        impact: selfReportImpact,
        explanation: describeImpact(
          'Your own energy check-in adjusts the prediction for today.',
          selfReportImpact
        ),
      },
    ]

    const score = clamp(
      this.config.baseScore +
        factors.reduce((total, factor) => total + factor.impact, 0),
      SCORE_MIN,
      SCORE_MAX
    )
    const band = energyBandFor(score)

    return {
      date: checkIn.date,
      score,
      band,
      headline:
        band === 'high'
          ? 'Strong energy expected today — reserve your best window for demanding work.'
          : band === 'moderate'
            ? 'Steady energy expected today — give one important task your best window.'
            : 'Lower energy expected today — keep the plan light and leave room for recovery.',
      factors,
    }
  }

  curve(score: EnergyScore, input: CheckInInput): EnergyCurvePoint[] {
    const checkIn = normalizeCheckIn(input)
    const sleepDebt = Math.max(0, 7.5 - checkIn.sleepHours)
    const stressAboveBaseline = Math.max(0, checkIn.stress - 3)
    const lateCaffeine = checkIn.caffeine === 'evening' ? 3 : checkIn.caffeine === 'afternoon' ? 1 : 0

    return this.config.curveOffsets.map(({ hour, offset }) => {
      const morningSleepAdjustment = hour <= 11 ? -Math.round(sleepDebt * 2) : 0
      const afternoonStressAdjustment = hour >= 13 && hour <= 17 ? -stressAboveBaseline * 3 : 0
      const eveningCaffeineAdjustment = hour >= 17 ? lateCaffeine : 0

      return {
        hour,
        level: clamp(
          score.score +
            offset +
            morningSleepAdjustment +
            afternoonStressAdjustment +
            eveningCaffeineAdjustment,
          SCORE_MIN,
          SCORE_MAX
        ),
      }
    })
  }

  evaluate(input: CheckInInput): EnergyResult {
    const score = this.score(input)
    const curve = this.curve(score, input)
    const peak = curve.reduce((best, point) =>
      point.level > best.level ? point : best
    )
    const afternoonCurve = curve.filter(
      (point) => point.hour >= 13 && point.hour <= 17
    )
    const dip = afternoonCurve.reduce((lowest, point) =>
      point.level < lowest.level ? point : lowest
    )
    const peakWindow = windowAround(peak.hour)
    const dipWindow = windowAround(dip.hour)

    return {
      ...score,
      headline:
        score.band === 'high'
          ? `Strong day ahead — protect ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for demanding work.`
          : score.band === 'moderate'
            ? `Steady day ahead — use ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for your most important task.`
            : `Lower-energy day — keep ${dipWindow.startHour}:00–${dipWindow.endHour}:00 light and make room for recovery.`,
      curve,
      peakWindow,
      dipWindow,
      computedAt: deterministicComputedAt(score.date),
    }
  }
}
