import type {
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  FridgeImageUpload,
  FridgeItem,
  IngredientRecognitionResult,
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
import { runSubmitCheckIn } from './checkin-flow'

interface AppState {
  profile: UserProfile | null
  energy: EnergyResult | null
  latestCheckIn: CheckInInput | null
  plan: DayPlan | null
  tasks: Task[]
  nutrition: NutritionPlan | null
  fridge: FridgeItem[]
  coach: CoachReply | null
  loading: boolean
  error: string | null
  ancillaryDate: string | null
  planLoading: boolean
  planError: string | null
  coachLoading: boolean
  coachError: string | null
}

interface AppActions {
  completeOnboarding(profile: UserProfile): Promise<void>
  submitCheckIn(input: CheckInInput): Promise<EnergyResult>
  refreshToday(): Promise<void>
  regeneratePlan(instruction?: string): Promise<void>
  recognizeFridgeImage(image: FridgeImageUpload): Promise<IngredientRecognitionResult>
  saveFridgeItems(items: FridgeItem[]): Promise<void>
  updateFridgeItem(item: FridgeItem): Promise<void>
  deleteFridgeItem(id: string): Promise<void>
  regenerateNutrition(): Promise<void>
}

const initialState: AppState = {
  profile: null,
  energy: null,
  latestCheckIn: null,
  plan: null,
  tasks: [],
  nutrition: null,
  fridge: [],
  coach: null,
  loading: false,
  error: null,
  ancillaryDate: null,
  planLoading: false,
  planError: null,
  coachLoading: false,
  coachError: null,
}

const AppStateContext = createContext<(AppState & AppActions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const service = getService()
  const refreshRequestId = useRef(0)

  const completeOnboarding = useCallback(
    async (profile: UserProfile) => {
      const saved = await service.saveProfile(profile)
      setState((prev) => ({ ...prev, profile: saved }))
    },
    [service]
  )

  const refreshToday = useCallback(async () => {
    const date = todayISO()
    const requestId = ++refreshRequestId.current
    setState((prev) => {
      const canKeepDateScopedData = prev.ancillaryDate === date
      return {
        ...prev,
        loading: true,
        error: null,
        planLoading: true,
        planError: null,
        coachLoading: true,
        coachError: null,
        tasks: canKeepDateScopedData ? prev.tasks : [],
        plan: canKeepDateScopedData ? prev.plan : null,
        nutrition: canKeepDateScopedData ? prev.nutrition : null,
        coach: canKeepDateScopedData ? prev.coach : null,
      }
    })

    // Start every request together, but publish Energy as soon as it settles.
    // Slow ancillary modules must not hold the Energy-first hero hostage.
    const energyRequest = service.getTodayEnergy(date)
    const ancillaryRequest = Promise.allSettled([
      service.getTasks(date),
      service.getTodayPlan(date),
      service.getNutritionPlan(date),
      service.getCoachReply(date),
      service.getFridgeItems(),
    ])

    try {
      const energy = await energyRequest
      if (refreshRequestId.current !== requestId) return
      setState((prev) => ({
        ...prev,
        energy,
        loading: false,
        error: null,
      }))
    } catch (cause) {
      if (refreshRequestId.current !== requestId) return
      console.error('refreshToday: energy load failed:', cause)
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          prev.energy?.date === date
            ? "Could not refresh today's energy. Showing your last result."
            : "Could not load today's data. Tap Retry to try again.",
      }))
    }

    const [tasksResult, planResult, nutritionResult, coachResult, fridgeResult] =
      await ancillaryRequest
    if (refreshRequestId.current !== requestId) return

    setState((prev) => ({
      ...prev,
      ancillaryDate: date,
      tasks:
        tasksResult.status === 'fulfilled'
          ? tasksResult.value
          : prev.ancillaryDate === date
            ? prev.tasks
            : [],
      plan:
        planResult.status === 'fulfilled'
          ? planResult.value
          : prev.ancillaryDate === date
            ? prev.plan
            : null,
      nutrition:
        nutritionResult.status === 'fulfilled'
          ? nutritionResult.value
          : prev.ancillaryDate === date
            ? prev.nutrition
            : null,
      coach:
        coachResult.status === 'fulfilled'
          ? coachResult.value
          : prev.ancillaryDate === date
            ? prev.coach
            : null,
      fridge: fridgeResult.status === 'fulfilled' ? fridgeResult.value : prev.fridge,
      planLoading: false,
      planError:
        planResult.status === 'rejected'
          ? "Could not load today's plan."
          : planResult.value
            ? null
            : "Today's plan is not ready yet.",
      coachLoading: false,
      coachError:
        coachResult.status === 'rejected' ? "Could not load today's coaching note." : null,
    }))
  }, [service])

  const submitCheckIn = useCallback(
    (input: CheckInInput) => {
      refreshRequestId.current += 1
      return runSubmitCheckIn(service, input, (patch) =>
        setState((prev) => ({ ...prev, ...patch }))
      )
    },
    [service]
  )

  const regeneratePlan = useCallback(
    async (instruction?: string) => {
      const date = todayISO()
      const { plan, coach } = await service.regeneratePlan(date, instruction)
      setState((prev) => ({
        ...prev,
        plan,
        coach,
        ancillaryDate: date,
        planError: null,
        coachError: null,
      }))
    },
    [service]
  )

  const recognizeFridgeImage = useCallback(
    (image: FridgeImageUpload) => service.recognizeFridgeImage(image),
    [service]
  )

  const regenerateNutrition = useCallback(async () => {
    const nutrition = await service.regenerateNutrition(todayISO())
    setState((prev) => ({ ...prev, nutrition }))
  }, [service])

  const saveFridgeItems = useCallback(
    async (items: FridgeItem[]) => {
      await service.saveFridgeItemsBatch(items)
      const [fridge, nutrition] = await Promise.all([
        service.getFridgeItems(),
        service.getNutritionPlan(todayISO()),
      ])
      setState((prev) => ({ ...prev, fridge, nutrition }))
    },
    [service]
  )

  const updateFridgeItem = useCallback(
    async (item: FridgeItem) => {
      await service.saveFridgeItem(item)
      const [fridge, nutrition] = await Promise.all([
        service.getFridgeItems(),
        service.getNutritionPlan(todayISO()),
      ])
      setState((prev) => ({ ...prev, fridge, nutrition }))
    },
    [service]
  )

  const deleteFridgeItem = useCallback(
    async (id: string) => {
      await service.deleteFridgeItem(id)
      const [fridge, nutrition] = await Promise.all([
        service.getFridgeItems(),
        service.getNutritionPlan(todayISO()),
      ])
      setState((prev) => ({ ...prev, fridge, nutrition }))
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
      recognizeFridgeImage,
      saveFridgeItems,
      updateFridgeItem,
      deleteFridgeItem,
      regenerateNutrition,
    }),
    [
      state,
      completeOnboarding,
      submitCheckIn,
      refreshToday,
      regeneratePlan,
      recognizeFridgeImage,
      saveFridgeItems,
      updateFridgeItem,
      deleteFridgeItem,
      regenerateNutrition,
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
