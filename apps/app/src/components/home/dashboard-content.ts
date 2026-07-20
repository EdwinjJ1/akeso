import type { CheckInInput, EnergyResult } from '@akeso/domain'

export interface DashboardContentInput {
  loading: boolean
  error: string | null
  energy: EnergyResult | null
  energyDate: string | null
  latestCheckIn: CheckInInput | null
  today: string
}

export interface DashboardContent {
  energy: EnergyResult | null
  promptMode: 'first' | 'daily' | null
}

export function selectDashboardContent({
  loading,
  error,
  energy,
  energyDate,
  latestCheckIn,
  today,
}: DashboardContentInput): DashboardContent {
  const todayEnergy = energyDate === today ? energy : null
  const promptMode = !loading && !error && !todayEnergy ? (latestCheckIn ? 'daily' : 'first') : null

  return { energy: todayEnergy, promptMode }
}
