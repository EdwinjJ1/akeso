import type { EnergyResult } from '@akeso/domain'

/**
 * The four mutually exclusive states the dashboard can be in. Rendering reads
 * exactly one of these, so the old bug — an error card and the check-in prompt
 * showing at the same time — is impossible by construction.
 */
export type DashboardState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; energy: EnergyResult; warning: string | null }

export interface DashboardStateInput {
  /** The most recent energy result held in state, for any date. */
  energy: EnergyResult | null
  /** Today as YYYY-MM-DD; energy for any other date is treated as absent. */
  today: string
  loading: boolean
  error: string | null
}

/**
 * Pure state selector for the dashboard.
 *
 * Once today's energy exists it stays visible during refreshes. A core refresh
 * error becomes a non-blocking warning instead of hiding known-good data. Only
 * when there is no energy for today do loading / error / empty apply.
 */
export function deriveDashboardState(input: DashboardStateInput): DashboardState {
  const todayEnergy = input.energy?.date === input.today ? input.energy : null

  if (todayEnergy) {
    return { status: 'ready', energy: todayEnergy, warning: input.error }
  }
  if (input.loading) {
    return { status: 'loading' }
  }
  if (input.error) {
    return { status: 'error', message: input.error }
  }
  return { status: 'empty' }
}
