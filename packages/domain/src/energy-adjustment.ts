import {
  deriveEnergyOutlook,
  energyBandFor,
  energyCurveFor,
} from './energy-engine'
import type { EnergyResult } from './types'

export interface ScoreAdjustmentOptions {
  /** Optional free-text "what we missed" note; blank strings are dropped. */
  note?: string
  /** Supplied by the caller so this function stays pure and testable. */
  adjustedAt: string
}

/**
 * Applies the user's manual score correction to an EnergyResult.
 *
 * The adjusted score REPLACES the engine's number downstream: band, curve,
 * peak/dip windows and headline are all re-derived from it, so every
 * consumer that reads the stored result (dashboard, planner, coach,
 * nutrition) sees a coherent day without merging anything. The check-in
 * factors are kept as-is — they describe what the user reported, which has
 * not changed. `adjustment.originalScore` preserves the engine's first
 * answer across repeated corrections so the coach can acknowledge the gap.
 *
 * Pure: never mutates `result`, never reads the clock.
 */
export function applyScoreAdjustment(
  result: EnergyResult,
  adjustedScore: number,
  options: ScoreAdjustmentOptions
): EnergyResult {
  const score = Math.round(Math.min(100, Math.max(0, adjustedScore)))
  const band = energyBandFor(score)
  const curve = energyCurveFor(score)
  // The user has told us directly how the day feels, so the headline never
  // uses the hedged "going mostly on how you feel" phrasing here.
  const outlook = deriveEnergyOutlook(band, curve, false)
  const note = options.note?.trim()

  return {
    ...result,
    score,
    band,
    curve,
    ...outlook,
    adjustment: {
      originalScore: result.adjustment?.originalScore ?? result.score,
      adjustedScore: score,
      ...(note ? { note } : {}),
      adjustedAt: options.adjustedAt,
    },
  }
}
