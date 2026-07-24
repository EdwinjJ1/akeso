import type {
  CheckInInput,
  EnergyBand,
  EnergyCurvePoint,
  EnergyFactor,
  EnergyFactorKey,
  EnergyResult,
  Hydration,
  HourWindow,
  LastMealTiming,
  Scale1to5,
  SleepDuration,
} from './types'
import { localDateSchema } from './schemas'

/**
 * The score-only portion of an EnergyResult.  Keeping this as a derived type
 * means the engine cannot drift from the shared API contract.  The headline
 * is excluded on purpose: it quotes the peak/dip windows, which only exist
 * once the curve has been computed, so evaluate() is its single home.
 */
export type EnergyScore = Pick<
  EnergyResult,
  'date' | 'score' | 'band' | 'factors'
>

type ScaleScoreMap = Readonly<Record<Scale1to5, number>>
type ContextFactorKey = Exclude<EnergyFactorKey, 'reported_energy'>

export interface EnergyEngineConfig {
  /** reportedEnergy 1..5 maps straight onto the score: 20/40/60/80/100. */
  readonly reportedEnergyScore: ScaleScoreMap
  readonly curveOffsets: readonly {
    readonly hour: number
    readonly offset: number
  }[]
}

/**
 * The sole home for the deterministic scoring rules.  In the remodelled
 * engine the score comes purely from the self-reported energy; sleep, last
 * meal and hydration are shown as possible context and never move the number.
 */
export const ENERGY_ENGINE_CONFIG: EnergyEngineConfig = {
  reportedEnergyScore: { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 },
  // A fixed circadian shape; only the score shifts it up or down, so the
  // curve never invents dips from factors the user didn't report.
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

interface ContextCopy {
  readonly label: string
  readonly explanation: string
}

const REPORTED_ENERGY_LABELS: Readonly<Record<Scale1to5, string>> = {
  1: 'Running low (1/5)',
  2: 'A bit low (2/5)',
  3: 'Middling (3/5)',
  4: 'Feeling good (4/5)',
  5: 'Feeling great (5/5)',
}

// `not_sure` is intentionally absent from every context map below: an unknown
// value produces no factor at all rather than a fabricated explanation.
const SLEEP_DURATION_COPY: Partial<Record<SleepDuration, ContextCopy>> = {
  under_5h: {
    label: 'Under 5h sleep',
    explanation: 'Well under a full night — a likely drag; protect an earlier wind-down tonight.',
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
    explanation: 'Plenty of sleep, though very long nights can still leave some grogginess.',
  },
}

const LAST_MEAL_COPY: Partial<Record<LastMealTiming, ContextCopy>> = {
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

const HYDRATION_COPY: Partial<Record<Hydration, ContextCopy>> = {
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

/**
 * Sanitized once here, so the result's `date` and `computedAt` can never
 * disagree about which day was scored. Reuses the shared calendar-date
 * schema from @akeso/contracts so an impossible date like 2026-13-45 is
 * rejected here too, not just format-checked.
 */
const normalizedDate = (date: string) =>
  localDateSchema.safeParse(date).success ? date : FALLBACK_DATE

export const energyBandFor = (score: number): EnergyBand => {
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

/** The fixed circadian shape shifted by the day's score, clamped to 0–100. */
export const energyCurveFor = (
  score: number,
  config: EnergyEngineConfig = ENERGY_ENGINE_CONFIG
): EnergyCurvePoint[] =>
  config.curveOffsets.map(({ hour, offset }) => ({
    hour,
    level: clamp(score + offset, SCORE_MIN, SCORE_MAX),
  }))

export interface EnergyOutlook {
  peakWindow: HourWindow
  dipWindow: HourWindow
  headline: string
}

/**
 * Peak/dip windows and the band-appropriate headline for a curve. `hedged`
 * switches to the "going mostly on how you feel" phrasing used when most of
 * the check-in context was left unknown.
 */
export const deriveEnergyOutlook = (
  band: EnergyBand,
  curve: readonly EnergyCurvePoint[],
  hedged: boolean
): EnergyOutlook => {
  const peak = curve.reduce((best, point) =>
    point.level > best.level ? point : best
  )
  const afternoonCurve = curve.filter(
    (point) => point.hour >= 13 && point.hour <= 17
  )
  // A custom config may plot no afternoon points; the dip then falls back
  // to the lowest point of the whole day instead of crashing.
  const dipCandidates = afternoonCurve.length > 0 ? afternoonCurve : curve
  const dip = dipCandidates.reduce((lowest, point) =>
    point.level < lowest.level ? point : lowest
  )
  const peakWindow = windowAround(peak.hour)
  const dipWindow = windowAround(dip.hour)

  const headline = hedged
    ? `Going mostly on how you feel today — treat ${peakWindow.startHour}:00–${peakWindow.endHour}:00 as your better window and keep the rest flexible.`
    : band === 'high'
      ? `Strong day ahead — protect ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for demanding work.`
      : band === 'moderate'
        ? `Steady day ahead — use ${peakWindow.startHour}:00–${peakWindow.endHour}:00 for your most important task.`
        : `Lower-energy day — keep ${dipWindow.startHour}:00–${dipWindow.endHour}:00 light and make room for recovery.`

  return { peakWindow, dipWindow, headline }
}

// Qualitative on purpose: the receipt explains the day without exposing the
// scoring mechanics (baseline, weights, point attributions) to the client.
const REPORTED_ENERGY_EXPLANATIONS: Readonly<Record<Scale1to5, string>> = {
  1: 'You said you’re running on empty — today starts gently, with recovery first.',
  2: 'You said you’re below your usual — today starts from a softer footing.',
  3: 'You reported a middling day — today starts from your usual level.',
  4: 'You said you’re feeling good — that sets a stronger starting point for today.',
  5: 'You said you’re feeling great — today starts from a strong place.',
}

const contextFactor = (
  key: ContextFactorKey,
  copy: ContextCopy | undefined
): EnergyFactor | null =>
  copy
    ? { key, label: copy.label, role: 'possible_context', explanation: copy.explanation }
    : null

/** How many of the three context inputs the user left as "not sure". */
const unknownContextCount = (input: CheckInInput): number =>
  [input.sleepDuration, input.lastMealTiming, input.hydration].filter(
    (value) => value === 'not_sure'
  ).length

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
  ) {
    if (config.curveOffsets.length === 0) {
      throw new Error('EnergyEngineConfig.curveOffsets needs at least one point')
    }
  }

  score(input: CheckInInput): EnergyScore {
    const reportedEnergy = normalizedScale(input.reportedEnergy)
    const score = clamp(
      this.config.reportedEnergyScore[reportedEnergy],
      SCORE_MIN,
      SCORE_MAX
    )
    const factors: EnergyFactor[] = [
      {
        key: 'reported_energy',
        label: REPORTED_ENERGY_LABELS[reportedEnergy],
        role: 'reported_energy',
        explanation: REPORTED_ENERGY_EXPLANATIONS[reportedEnergy],
      },
    ]

    for (const factor of [
      contextFactor('sleep_duration', SLEEP_DURATION_COPY[input.sleepDuration]),
      contextFactor('last_meal', LAST_MEAL_COPY[input.lastMealTiming]),
      contextFactor('hydration', HYDRATION_COPY[input.hydration]),
    ]) {
      if (factor) factors.push(factor)
    }

    return {
      date: normalizedDate(input.date),
      score,
      band: energyBandFor(score),
      factors,
    }
  }

  curve(score: EnergyScore): EnergyCurvePoint[] {
    return energyCurveFor(score.score, this.config)
  }

  evaluate(input: CheckInInput): EnergyResult {
    const score = this.score(input)
    const curve = this.curve(score)
    // When most context is unknown we say so, and lean on the self-report
    // rather than implying a precisely modelled day.
    const outlook = deriveEnergyOutlook(
      score.band,
      curve,
      unknownContextCount(input) >= 2
    )

    return {
      ...score,
      ...outlook,
      curve,
      // Deterministic by design: derived from the sanitized check-in date,
      // never from the wall clock, so identical input yields an identical
      // result.
      computedAt: `${score.date}T00:00:00.000Z`,
    }
  }
}
