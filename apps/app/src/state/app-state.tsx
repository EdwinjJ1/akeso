import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
  Task,
  UserProfile,
} from '@akeso/domain'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { getService } from '@/services'
import { todayISO } from '@/utils/dates'

interface AppState {
  profile: UserProfile | null
  energy: EnergyResult | null
  latestCheckIn: CheckInInput | null
  plan: DayPlan | null
  tasks: Task[]
  nutrition: NutritionPlan | null
  coach: CoachReply | null
  loading: boolean
  error: string | null
}

interface AppActions {
  completeOnboarding(profile: UserProfile): Promise<void>
  submitCheckIn(input: CheckInInput): Promise<EnergyResult>
  loadLatestCheckIn(date: string): Promise<CheckInInput | null>
  refreshToday(): Promise<void>
  regeneratePlan(instruction?: string): Promise<void>
}

const initialState: AppState = {
  profile: null,
  energy: null,
  latestCheckIn: null,
  plan: null,
  tasks: [],
  nutrition: null,
  coach: null,
  loading: false,
  error: null,
}

const AppStateContext = createContext<(AppState & AppActions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const service = getService()

  const completeOnboarding = useCallback(
    async (profile: UserProfile) => {
      const saved = await service.saveProfile(profile)
      setState((prev) => ({ ...prev, profile: saved }))
    },
    [service]
  )

  const refreshToday = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const date = todayISO()
      const [energy, tasks, plan, nutrition, coach, latestCheckIn] = await Promise.all([
        service.getTodayEnergy(date),
        service.getTasks(date),
        service.getTodayPlan(date),
        service.getNutritionPlan(date),
        service.getCoachReply(date),
        service.getLatestCheckIn(date),
      ])
      setState((prev) => ({
        ...prev,
        energy,
        latestCheckIn,
        tasks,
        plan,
        nutrition,
        coach,
        loading: false,
      }))
    } catch (error) {
      console.error('refreshToday failed:', error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Could not load today’s data. Pull to retry.',
      }))
    }
  }, [service])

  const loadLatestCheckIn = useCallback(
    async (date: string) => {
      const latestCheckIn = await service.getLatestCheckIn(date)
      setState((prev) => ({ ...prev, latestCheckIn }))
      return latestCheckIn
    },
    [service]
  )

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      const energy = await service.submitCheckIn(input)
      setState((prev) => ({ ...prev, energy }))
      const [plan, nutrition, coach] = await Promise.all([
        service.getTodayPlan(input.date),
        service.getNutritionPlan(input.date),
        service.getCoachReply(input.date),
      ])
      setState((prev) => ({ ...prev, plan, nutrition, coach }))
      return energy
    },
    [service]
  )

  const regeneratePlan = useCallback(
    async (instruction?: string) => {
      const { plan, coach } = await service.regeneratePlan(todayISO(), instruction)
      setState((prev) => ({ ...prev, plan, coach }))
    },
    [service]
  )

  const value = useMemo(
    () => ({
      ...state,
      completeOnboarding,
      submitCheckIn,
      loadLatestCheckIn,
      refreshToday,
      regeneratePlan,
    }),
    [state, completeOnboarding, submitCheckIn, loadLatestCheckIn, refreshToday, regeneratePlan]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider')
  }
  return context
}
