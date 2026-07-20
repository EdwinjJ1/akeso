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
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { getService } from '@/services'
import { todayISO } from '@/utils/dates'

interface AppState {
  profile: UserProfile | null
  energy: EnergyResult | null
  energyDate: string | null
  latestCheckIn: CheckInInput | null
  plan: DayPlan | null
  tasks: Task[]
  nutrition: NutritionPlan | null
  coach: CoachReply | null
  initialized: boolean
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
  energyDate: null,
  latestCheckIn: null,
  plan: null,
  tasks: [],
  nutrition: null,
  coach: null,
  initialized: false,
  loading: false,
  error: null,
}

const AppStateContext = createContext<(AppState & AppActions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const refreshGeneration = useRef(0)
  const submissionGeneration = useRef(0)
  const service = getService()

  const completeOnboarding = useCallback(
    async (profile: UserProfile) => {
      const saved = await service.saveProfile(profile)
      setState((prev) => ({ ...prev, profile: saved }))
    },
    [service]
  )

  const refreshToday = useCallback(async () => {
    const generation = ++refreshGeneration.current
    // Keep current data on screen while refreshing; stale-day display is
    // prevented by date gating in selectDashboardContent, not by clearing.
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
      if (generation !== refreshGeneration.current) return
      setState((prev) => ({
        ...prev,
        energy,
        energyDate: date,
        latestCheckIn,
        tasks,
        plan,
        nutrition,
        coach,
        initialized: true,
        loading: false,
      }))
    } catch (error) {
      if (generation !== refreshGeneration.current) return
      console.error('refreshToday failed:', error)
      setState((prev) => ({
        ...prev,
        initialized: true,
        loading: false,
        error: 'Could not load today’s data.',
      }))
    }
  }, [service])

  const loadLatestCheckIn = useCallback(
    async (date: string) => {
      const generation = refreshGeneration.current
      const latestCheckIn = await service.getLatestCheckIn(date)
      if (generation === refreshGeneration.current) {
        setState((prev) => ({ ...prev, latestCheckIn }))
      }
      return latestCheckIn
    },
    [service]
  )

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      const generation = ++submissionGeneration.current
      const submittedInput = { ...input }
      const energy = await service.submitCheckIn({ ...submittedInput })
      if (generation !== submissionGeneration.current) return energy

      const dashboardGeneration = ++refreshGeneration.current
      setState((prev) => ({
        ...prev,
        energy,
        energyDate: submittedInput.date,
        latestCheckIn: { ...submittedInput },
        plan: null,
        nutrition: null,
        coach: null,
        initialized: true,
        loading: false,
        error: null,
      }))

      try {
        const [plan, nutrition, coach] = await Promise.all([
          service.getTodayPlan(submittedInput.date),
          service.getNutritionPlan(submittedInput.date),
          service.getCoachReply(submittedInput.date),
        ])
        if (
          generation === submissionGeneration.current &&
          dashboardGeneration === refreshGeneration.current
        ) {
          setState((prev) => ({ ...prev, plan, nutrition, coach }))
        }
      } catch (error) {
        if (
          generation === submissionGeneration.current &&
          dashboardGeneration === refreshGeneration.current
        ) {
          console.error('Post-check-in refresh failed:', error)
          setState((prev) => ({
            ...prev,
            error:
              'Your check-in was saved, but today’s guidance could not load. Retry from the dashboard.',
          }))
        }
      }

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
