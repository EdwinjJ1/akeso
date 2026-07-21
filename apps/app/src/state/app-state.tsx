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
      const [energy, tasks, plan, nutrition, coach, fridge] = await Promise.all([
        service.getTodayEnergy(date),
        service.getTasks(date),
        service.getTodayPlan(date),
        service.getNutritionPlan(date),
        service.getCoachReply(date),
        service.getFridgeItems(),
      ])
      setState((prev) => ({
        ...prev,
        energy,
        tasks,
        plan,
        nutrition,
        coach,
        fridge,
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

  const submitCheckIn = useCallback(
    (input: CheckInInput) =>
      runSubmitCheckIn(service, input, (patch) =>
        setState((prev) => ({ ...prev, ...patch }))
      ),
    [service]
  )

  const regeneratePlan = useCallback(
    async (instruction?: string) => {
      const { plan, coach } = await service.regeneratePlan(todayISO(), instruction)
      setState((prev) => ({ ...prev, plan, coach }))
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
        service.regenerateNutrition(todayISO()),
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
        service.regenerateNutrition(todayISO()),
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
        service.regenerateNutrition(todayISO()),
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
