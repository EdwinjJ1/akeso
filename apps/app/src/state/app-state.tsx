import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { getService } from '@/services'
import { syncReminderSchedule } from '@/services/notifications'
import { todayISO } from '@/utils/dates'
import { runSubmitCheckIn } from './checkin-flow'

interface AppState {
  profile: UserProfile | null
  energy: EnergyResult | null
  latestCheckIn: CheckInInput | null
  plan: DayPlan | null
  tasks: Task[]
  nutrition: NutritionPlan | null
  coach: CoachReply | null
  reminder: ReminderPreference | null
  loading: boolean
  error: string | null
}

interface AppActions {
  completeOnboarding(profile: UserProfile): Promise<void>
  submitCheckIn(input: CheckInInput): Promise<EnergyResult>
  refreshToday(): Promise<void>
  regeneratePlan(instruction?: string): Promise<void>
  saveReminderPreference(pref: ReminderPreference): Promise<void>
}

const initialState: AppState = {
  profile: null,
  energy: null,
  latestCheckIn: null,
  plan: null,
  tasks: [],
  nutrition: null,
  coach: null,
  reminder: null,
  loading: false,
  error: null,
}

const AppStateContext = createContext<(AppState & AppActions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const service = getService()

  /**
   * Read inside submitCheckIn/saveReminderPreference without making those
   * callbacks depend on (and be recreated by) every state change — both
   * only need the latest values at the moment they run, not to react to
   * changes in between.
   */
  const latestRef = useRef({ energy: state.energy, reminder: state.reminder })
  useEffect(() => {
    latestRef.current = { energy: state.energy, reminder: state.reminder }
  }, [state.energy, state.reminder])

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
      const [energy, tasks, plan, nutrition, coach, reminder] = await Promise.all([
        service.getTodayEnergy(date),
        service.getTasks(date),
        service.getTodayPlan(date),
        service.getNutritionPlan(date),
        service.getCoachReply(date),
        service.getReminderPreference(),
      ])
      setState((prev) => ({
        ...prev,
        energy,
        tasks,
        plan,
        nutrition,
        coach,
        reminder,
        loading: false,
      }))
      // Re-syncs the on-device schedule every time the app opens — the
      // cheapest way to recover from the app being killed mid-schedule, a
      // check-in completed since the last open, or a day boundary crossed
      // while it was closed.
      if (reminder) {
        await syncReminderSchedule(reminder, energy !== null)
      }
    } catch (error) {
      console.error('refreshToday failed:', error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Could not load today’s data. Pull to retry.',
      }))
    }
  }, [service])

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      const energy = await runSubmitCheckIn(service, input, (patch) =>
        setState((prev) => ({ ...prev, ...patch }))
      )
      // Today's check-in is now done — clears any pending reminder and
      // schedules tomorrow's instead of leaving today's notification to fire.
      const { reminder } = latestRef.current
      if (reminder) {
        await syncReminderSchedule(reminder, true)
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

  const saveReminderPreference = useCallback(
    async (pref: ReminderPreference) => {
      const saved = await service.saveReminderPreference(pref)
      setState((prev) => ({ ...prev, reminder: saved }))
      await syncReminderSchedule(saved, latestRef.current.energy !== null)
    },
    [service]
  )

  const value = useMemo(
    () => ({
      ...state,
      completeOnboarding,
      submitCheckIn,
      refreshToday,
      regeneratePlan,
      saveReminderPreference,
    }),
    [
      state,
      completeOnboarding,
      submitCheckIn,
      refreshToday,
      regeneratePlan,
      saveReminderPreference,
    ]
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
