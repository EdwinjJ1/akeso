import type {
  CheckInInput,
  EnergyBand,
  EnergyCurvePoint,
  EnergyFactor,
  EnergyHistorySample,
  EnergyResult,
  Hydration,
  HourWindow,
  LastMealTiming,
  Scale1to5,
  SleepDuration,
} from './types'
import { localDateSchema } from './schemas'

export const LEGACY_ENERGY_ALGORITHM_VERSION = 'energy-v1-self-report'
export const CURRENT_ENERGY_ALGORITHM_VERSION = 'energy-v2-multisignal'

type ScaleImpactMap = Readonly<Record<Scale1to5, number>>
type KnownSleep = Exclude<SleepDuration, 'not_sure'>
type KnownMeal = Exclude<LastMealTiming, 'not_sure'>
type KnownHydration = Exclude<Hydration, 'not_sure'>

interface WeightedCopy {
  readonly label: string
  readonly impact: number
  readonly explanation: string
}

interface ContextCopy {
  readonly label: string
  readonly explanation: string
}

export interface EnergyEngineConfig {
  readonly version: typeof CURRENT_ENERGY_ALGORITHM_VERSION
  readonly neutralScore: number
  readonly minimumHistorySamples: number
  readonly maximumHistorySamples: number
  readonly reportedEnergyImpacts: ScaleImpactMap
  readonly sleep: Readonly<Record<KnownSleep, WeightedCopy>>
  readonly meal: Readonly<Record<KnownMeal, WeightedCopy>>
  readonly hydration: Readonly<Record<KnownHydration, WeightedCopy>>
  readonly curveOffsets: readonly {
    readonly hour: number
    readonly offset: number
  }[]
}

export interface EnergyEvaluationContext {
  readonly history?: readonly EnergyHistorySample[]
  /** Persisted snapshot used by audit replay so later calibration cannot rewrite history. */
  readonly baseline?: EnergyResult['personalBaseline']
}

export type EnergyScore = Pick<
  EnergyResult,
  | 'date'
  | 'score'
  | 'band'
  | 'algorithmVersion'
  | 'confidence'
  | 'personalBaseline'
  | 'baselineDelta'
  | 'baselineExplanation'
  | 'factors'
>

export const ENERGY_ENGINE_CONFIG: EnergyEngineConfig = {
  version: CURRENT_ENERGY_ALGORITHM_VERSION,
  neutralScore: 60,
  minimumHistorySamples: 3,
  maximumHistorySamples: 28,
  reportedEnergyImpacts: { 1: -24, 2: -12, 3: 0, 4: 12, 5: 24 },
  sleep: {
    under_5h: {
      label: 'Under 5h sleep',
      impact: -14,
      explanation: 'A very short night is a meaningful drag on today’s estimate.',
    },
    '5_6h': {
      label: '5–6h sleep',
      impact: -9,
      explanation: 'A short night pulls today’s estimate down.',
    },
    '6_7h': {
      label: '6–7h sleep',
      impact: -4,
      explanation: 'Slightly short sleep is a small headwind today.',
    },
    '7_8h': {
      label: '7–8h sleep',
      impact: 5,
      explanation: 'A solid night supports today’s estimate.',
    },
    '8_9h': {
      label: '8–9h sleep',
      impact: 4,
      explanation: 'A full night supports today’s estimate.',
    },
    over_9h: {
      label: 'Over 9h sleep',
      impact: 0,
      explanation: 'A long night is treated neutrally without assuming how it felt.',
    },
  },
  meal: {
    within_1h: {
      label: 'Ate within the last hour',
      impact: -2,
      explanation: 'A brief post-meal dip is possible, so the adjustment is small.',
    },
    '1_3h': {
      label: 'Ate 1–3h ago',
      impact: 4,
      explanation: 'Recent fuel supports today’s estimate.',
    },
    '3_5h': {
      label: 'Ate 3–5h ago',
      impact: 0,
      explanation: 'This timing is treated as neutral.',
    },
    over_5h: {
      label: 'Ate over 5h ago',
      impact: -7,
      explanation: 'A long gap since eating can be a headwind.',
    },
    not_today: {
      label: 'Not eaten yet today',
      impact: -12,
      explanation: 'No food yet today is a meaningful fuel-related headwind.',
    },
  },
  hydration: {
    under_0_5l: {
      label: 'Under 0.5L water',
      impact: -10,
      explanation: 'Very light fluid intake pulls today’s estimate down.',
    },
    '0_5_1l': {
      label: '0.5–1L water',
      impact: -6,
      explanation: 'Light fluid intake is a modest headwind.',
    },
    '1_1_5l': {
      label: '1–1.5L water',
      impact: -2,
      explanation: 'This intake is treated as slightly below the daytime reference.',
    },
    '1_5_2l': {
      label: '1.5–2L water',
      impact: 3,
      explanation: 'Steady hydration supports today’s estimate.',
    },
    over_2l: {
      label: 'Over 2L water',
      impact: 3,
      explanation: 'Reported hydration supports today’s estimate without adding precision.',
    },
  },
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
const FALLBACK_DATE = '1970-01-01'
const SCALE_SCORE: Readonly<Record<Scale1to5, number>> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
}

const REPORTED_ENERGY_LABELS: Readonly<Record<Scale1to5, string>> = {
  1: 'Running low (1/5)',
  2: 'A bit low (2/5)',
  3: 'Middling (3/5)',
  4: 'Feeling good (4/5)',
  5: 'Feeling great (5/5)',
}

// Frozen v1 copy is retained solely for historical replay.
const LEGACY_SLEEP_COPY: Partial<Record<SleepDuration, ContextCopy>> = {
  under_5h: {
    label: 'Under 5h sleep',
    explanation:
      'Well under a full night — a likely drag; protect an earlier wind-down tonight.',
  },
  '5_6h': {
    label: '5–6h sleep',
    explanation: 'A little short — you may notice it by the afternoon.',
  },
  '6_7h': {
    label: '6–7h sleep',
    explanation: 'Just under your target range.',
  },
  '7_8h': {
    label: '7–8h sleep',
    explanation: 'Around a solid night — a likely support for today.',
  },
  '8_9h': {
    label: '8–9h sleep',
    explanation: 'A full night — a likely support for today.',
  },
  over_9h: {
    label: 'Over 9h sleep',
    explanation:
      'Plenty of sleep, though very long nights can still leave some grogginess.',
  },
}

const LEGACY_MEAL_COPY: Partial<Record<LastMealTiming, ContextCopy>> = {
  within_1h: {
    label: 'Ate within the last hour',
    explanation: 'Freshly fuelled — a brief post-meal dip is normal.',
  },
  '1_3h': {
    label: 'Ate 1–3h ago',
    explanation: 'Recent enough that fuel probably isn’t dragging you.',
  },
  '3_5h': {
    label: 'Ate 3–5h ago',
    explanation: 'Heading toward your next meal — a snack may steady the afternoon.',
  },
  over_5h: {
    label: 'Ate over 5h ago',
    explanation: 'It’s been a while — low fuel can read as low energy.',
  },
  not_today: {
    label: 'Not eaten yet today',
    explanation: 'Running on empty can feel like fatigue; eating something may help.',
  },
}

const LEGACY_HYDRATION_COPY: Partial<Record<Hydration, ContextCopy>> = {
  under_0_5l: {
    label: 'Under 0.5L water',
    explanation: 'Very light on fluids — low intake may contribute to feeling tired.',
  },
  '0_5_1l': {
    label: '0.5–1L water',
    explanation: 'On the light side — topping up may help.',
  },
  '1_1_5l': {
    label: '1–1.5L water',
    explanation: 'Making progress — keep sipping through the day.',
  },
  '1_5_2l': {
    label: '1.5–2L water',
    explanation: 'Well hydrated so far.',
  },
  over_2l: {
    label: 'Over 2L water',
    explanation: 'Nicely hydrated today.',
  },
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const normalizedNumber = (value: number, minimum: number, maximum: number) =>
  Number.isFinite(value) ? clamp(value, minimum, maximum) : minimum

const normalizedScale = (value: number): Scale1to5 =>
  Math.round(normalizedNumber(value, 1, 5)) as Scale1to5

const normalizedDate = (date: string) =>
  localDateSchema.safeParse(date).success ? date : FALLBACK_DATE

const energyBandFor = (score: number): EnergyBand => {
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

const windowAround = (hour: number): HourWindow => ({
  startHour: Math.max(0, hour - 1),
  endHour: Math.min(24, hour + 1),
})

const scoredFactor = (
  key: EnergyFactor['key'],
  copy: WeightedCopy
): EnergyFactor => ({
  key,
  label: copy.label,
  role: 'scored_signal',
  impact: copy.impact,
  explanation: copy.explanation,
})

const legacyContextFactor = (
  key: 'sleep_duration' | 'last_meal' | 'hydration',
  copy: ContextCopy | undefined
): EnergyFactor | null =>
  copy
    ? {
        key,
        label: copy.label,
        role: 'possible_context',
        explanation: copy.explanation,
      }
    : null

const timeRhythmCopy = (localHour: number | undefined): WeightedCopy | null => {
  if (localHour === undefined || !Number.isInteger(localHour)) return null
  const hour = clamp(localHour, 0, 23)
  if (hour < 7)
    return {
      label: 'Early-hours rhythm',
      impact: -8,
      explanation: 'This hour sits before the usual daytime rise.',
    }
  if (hour < 9)
    return {
      label: 'Morning ramp-up',
      impact: -3,
      explanation: 'Your modelled daytime rhythm is still ramping up.',
    }
  if (hour < 13)
    return {
      label: 'Daytime peak window',
      impact: 4,
      explanation: 'This hour falls in the modelled daytime peak.',
    }
  if (hour < 15)
    return {
      label: 'Early-afternoon transition',
      impact: -1,
      explanation: 'This hour is treated as a near-neutral transition.',
    }
  if (hour < 18)
    return {
      label: 'Afternoon dip window',
      impact: -6,
      explanation: 'This hour falls in the modelled afternoon dip.',
    }
  if (hour < 21)
    return {
      label: 'Evening wind-down',
      impact: -3,
      explanation: 'The model applies a small evening wind-down adjustment.',
    }
  return {
    label: 'Late-hours rhythm',
    impact: -7,
    explanation: 'This hour sits in the modelled late-day wind-down.',
  }
}

const knownSignalCount = (input: CheckInInput) =>
  [
    input.sleepDuration !== 'not_sure',
    input.lastMealTiming !== 'not_sure',
    input.hydration !== 'not_sure',
    input.localHour !== undefined,
  ].filter(Boolean).length

const historicalBaseline = (
  date: string,
  context: EnergyEvaluationContext,
  config: EnergyEngineConfig
): EnergyResult['personalBaseline'] => {
  if (context.baseline) {
    return {
      score: clamp(
        Math.round(context.baseline.score),
        SCORE_MIN,
        SCORE_MAX
      ),
      sampleSize: clamp(
        Math.round(context.baseline.sampleSize),
        0,
        config.maximumHistorySamples
      ),
      source: context.baseline.source,
    }
  }
  const history = (context.history ?? [])
    .filter(
      (sample) =>
        localDateSchema.safeParse(sample.date).success && sample.date < date
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, config.maximumHistorySamples)

  if (history.length < config.minimumHistorySamples) {
    return { score: config.neutralScore, sampleSize: history.length, source: 'cold_start' }
  }

  let weightedTotal = 0
  let weight = 0
  let calibratedCount = 0
  for (const sample of history) {
    const value = sample.calibratedEnergy ?? sample.reportedEnergy
    const sampleWeight = sample.calibratedEnergy === undefined ? 1 : 2
    if (sample.calibratedEnergy !== undefined) calibratedCount += 1
    weightedTotal += SCALE_SCORE[normalizedScale(value)] * sampleWeight
    weight += sampleWeight
  }

  return {
    score: clamp(Math.round(weightedTotal / weight), SCORE_MIN, SCORE_MAX),
    sampleSize: history.length,
    source: calibratedCount > 0 ? 'calibrated' : 'history',
  }
}

const reportedExplanation = (level: Scale1to5, impact: number) => {
  if (impact > 0)
    return `Your ${level}/5 self-report adds ${impact} points to today’s estimate.`
  if (impact < 0)
    return `Your ${level}/5 self-report subtracts ${Math.abs(impact)} points from today’s estimate.`
  return `Your ${level}/5 self-report is neutral in this version.`
}

const legacyReportedExplanation = (level: Scale1to5, impact: number) => {
  if (impact > 0)
    return `You reported your energy as ${level}/5 — that lifts today’s baseline by ${impact}.`
  if (impact < 0)
    return `You reported your energy as ${level}/5 — that pulls today’s baseline down by ${Math.abs(impact)}.`
  return `You reported your energy as ${level}/5 — right at your neutral baseline.`
}

const relativeExplanation = (
  delta: number,
  baseline: EnergyResult['personalBaseline'],
  factors: readonly EnergyFactor[]
) => {
  const source =
    baseline.source === 'cold_start'
      ? 'safe cold-start baseline'
      : baseline.source === 'calibrated'
        ? `calibrated ${baseline.sampleSize}-day baseline`
        : `${baseline.sampleSize}-day personal baseline`
  const ranked = factors
    .filter(
      (factor): factor is Extract<EnergyFactor, { role: 'scored_signal' }> =>
        factor.role === 'scored_signal' &&
        factor.key !== 'personal_baseline' &&
        factor.impact !== 0
    )
    .sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact))
    .slice(0, 2)
    .map((factor) => factor.label.toLowerCase())

  const reasons =
    ranked.length > 0 ? ` The largest signals were ${ranked.join(' and ')}.` : ''
  if (delta > 0)
    return `Today is ${delta} points above your ${source}.${reasons}`
  if (delta < 0)
    return `Today is ${Math.abs(delta)} points below your ${source}.${reasons}`
  return `Today is level with your ${source}.${reasons}`
}

const confidenceFor = (
  input: CheckInInput,
  baseline: EnergyResult['personalBaseline'],
  factors: readonly EnergyFactor[]
) => {
  const reported = factors.find((factor) => factor.key === 'reported_energy')
  const contextImpact = factors
    .filter(
      (factor): factor is Extract<EnergyFactor, { role: 'scored_signal' }> =>
        factor.role === 'scored_signal' &&
        !['reported_energy', 'personal_baseline'].includes(factor.key)
    )
    .reduce((total, factor) => total + factor.impact, 0)
  const conflict =
    reported?.role === 'scored_signal' &&
    Math.abs(reported.impact) >= 12 &&
    Math.abs(contextImpact) >= 8 &&
    Math.sign(reported.impact) !== Math.sign(contextImpact)
  const historyLift =
    baseline.source === 'cold_start'
      ? Math.min(0.04, baseline.sampleSize * 0.01)
      : Math.min(0.16, baseline.sampleSize * 0.02)
  const calibrationLift = baseline.source === 'calibrated' ? 0.04 : 0
  return Number(
    clamp(
      0.48 +
        knownSignalCount(input) * 0.07 +
        historyLift +
        calibrationLift -
        (conflict ? 0.1 : 0),
      0.35,
      0.95
    ).toFixed(2)
  )
}

/**
 * Pure deterministic scoring authority. Generative AI is deliberately absent:
 * it cannot generate, mutate, calibrate, or persist a score.
 */
export class EnergyEngine {
  private readonly mode: 'legacy' | 'multisignal'

  constructor(
    private readonly config: EnergyEngineConfig = ENERGY_ENGINE_CONFIG,
    mode: 'legacy' | 'multisignal' = 'multisignal'
  ) {
    if (config.curveOffsets.length === 0) {
      throw new Error('EnergyEngineConfig.curveOffsets needs at least one point')
    }
    this.mode = mode
  }

  static forVersion(version: string): EnergyEngine {
    if (version === CURRENT_ENERGY_ALGORITHM_VERSION) return new EnergyEngine()
    if (version === LEGACY_ENERGY_ALGORITHM_VERSION) {
      return new EnergyEngine(ENERGY_ENGINE_CONFIG, 'legacy')
    }
    throw new Error(`Unsupported energy algorithm version: ${version}`)
  }

  score(
    input: CheckInInput,
    context: EnergyEvaluationContext = {}
  ): EnergyScore {
    return this.mode === 'legacy'
      ? this.legacyScore(input)
      : this.multisignalScore(input, context)
  }

  private legacyScore(input: CheckInInput): EnergyScore {
    const date = normalizedDate(input.date)
    const reportedEnergy = normalizedScale(input.reportedEnergy)
    const score = SCALE_SCORE[reportedEnergy]
    const impact = score - ENERGY_ENGINE_CONFIG.neutralScore
    const factors: EnergyFactor[] = [
      {
        key: 'reported_energy',
        label: REPORTED_ENERGY_LABELS[reportedEnergy],
        role: 'reported_energy',
        impact,
        explanation: legacyReportedExplanation(reportedEnergy, impact),
      },
    ]
    for (const factor of [
      legacyContextFactor(
        'sleep_duration',
        LEGACY_SLEEP_COPY[input.sleepDuration]
      ),
      legacyContextFactor('last_meal', LEGACY_MEAL_COPY[input.lastMealTiming]),
      legacyContextFactor(
        'hydration',
        LEGACY_HYDRATION_COPY[input.hydration]
      ),
    ]) {
      if (factor) factors.push(factor)
    }
    const baseline = { score: 60, sampleSize: 0, source: 'cold_start' as const }
    return {
      date,
      score,
      band: energyBandFor(score),
      algorithmVersion: LEGACY_ENERGY_ALGORITHM_VERSION,
      confidence: 0.5,
      personalBaseline: baseline,
      baselineDelta: score - baseline.score,
      baselineExplanation:
        'Historical v1 score compared with the safe cold-start baseline.',
      factors,
    }
  }

  private multisignalScore(
    input: CheckInInput,
    context: EnergyEvaluationContext
  ): EnergyScore {
    const date = normalizedDate(input.date)
    const reportedEnergy = normalizedScale(input.reportedEnergy)
    const baseline = historicalBaseline(date, context, this.config)
    const baselineImpact = baseline.score - this.config.neutralScore
    const factors: EnergyFactor[] = []

    if (baseline.source !== 'cold_start' || baselineImpact !== 0) {
      factors.push(
        scoredFactor('personal_baseline', {
          label:
            baseline.source === 'calibrated'
              ? 'Calibrated personal baseline'
              : 'Personal history baseline',
          impact: baselineImpact,
          explanation: `${baseline.sampleSize} earlier check-ins set the starting point at ${baseline.score}/100.`,
        })
      )
    }

    const reportedImpact = this.config.reportedEnergyImpacts[reportedEnergy]
    factors.push(
      scoredFactor('reported_energy', {
        label: REPORTED_ENERGY_LABELS[reportedEnergy],
        impact: reportedImpact,
        explanation: reportedExplanation(reportedEnergy, reportedImpact),
      })
    )

    const sleep =
      input.sleepDuration === 'not_sure'
        ? null
        : this.config.sleep[input.sleepDuration]
    const meal =
      input.lastMealTiming === 'not_sure'
        ? null
        : this.config.meal[input.lastMealTiming]
    const hydration =
      input.hydration === 'not_sure'
        ? null
        : this.config.hydration[input.hydration]
    const rhythm = timeRhythmCopy(input.localHour)

    if (sleep) factors.push(scoredFactor('sleep_duration', sleep))
    if (meal) factors.push(scoredFactor('last_meal', meal))
    if (hydration) factors.push(scoredFactor('hydration', hydration))
    if (rhythm) factors.push(scoredFactor('time_rhythm', rhythm))

    const score = clamp(
      this.config.neutralScore +
        factors.reduce(
          (total, factor) =>
            total +
            (factor.role === 'scored_signal' ? factor.impact : 0),
          0
        ),
      SCORE_MIN,
      SCORE_MAX
    )
    const baselineDelta = score - baseline.score
    return {
      date,
      score,
      band: energyBandFor(score),
      algorithmVersion: this.config.version,
      confidence: confidenceFor(input, baseline, factors),
      personalBaseline: baseline,
      baselineDelta,
      baselineExplanation: relativeExplanation(baselineDelta, baseline, factors),
      factors,
    }
  }

  curve(score: EnergyScore): EnergyCurvePoint[] {
    return this.config.curveOffsets.map(({ hour, offset }) => ({
      hour,
      level: clamp(score.score + offset, SCORE_MIN, SCORE_MAX),
    }))
  }

  evaluate(
    input: CheckInInput,
    context: EnergyEvaluationContext = {}
  ): EnergyResult {
    const score = this.score(input, context)
    const curve = this.curve(score)
    const peak = curve.reduce((best, point) =>
      point.level > best.level ? point : best
    )
    const afternoonCurve = curve.filter(
      (point) => point.hour >= 13 && point.hour <= 17
    )
    const dipCandidates = afternoonCurve.length > 0 ? afternoonCurve : curve
    const dip = dipCandidates.reduce((lowest, point) =>
      point.level < lowest.level ? point : lowest
    )
    const peakWindow = windowAround(peak.hour)
    const dipWindow = windowAround(dip.hour)
    const legacyUnknownCount = [
      input.sleepDuration,
      input.lastMealTiming,
      input.hydration,
    ].filter((value) => value === 'not_sure').length
    const headline =
      this.mode === 'legacy' && legacyUnknownCount >= 2
        ? `Going mostly on how you feel today — treat ${peakWindow.startHour}:00–${peakWindow.endHour}:00 as your better window and keep the rest flexible.`
        : this.mode !== 'legacy' && score.confidence < 0.6
        ? `Limited signals today — use ${peakWindow.startHour}:00–${peakWindow.endHour}:00 as a flexible guide.`
        : score.band === 'high'
          ? `Strong day ahead — protect ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for demanding work.`
          : score.band === 'moderate'
            ? `Steady day ahead — use ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for your most important task.`
            : `Lower-energy day — keep ${dipWindow.startHour}:00–${dipWindow.endHour}:00 light and make room for recovery.`

    return {
      ...score,
      headline,
      curve,
      peakWindow,
      dipWindow,
      computedAt: `${score.date}T00:00:00.000Z`,
    }
  }
}
