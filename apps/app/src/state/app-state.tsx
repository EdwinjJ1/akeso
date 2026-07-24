import type {
  CheckInInput,
  CoachChatRequest,
  CoachReply,
  CreateReportRequest,
  DayPlan,
  EnergyResult,
  FridgeImageUpload,
  FridgeItem,
  HealthReport,
  HealthRecommendationSet,
  IngredientRecognitionResult,
  NutritionPlan,
  ReminderPreference,
  ReportChatReply,
  ReportChatRequest,
  ReportExtractionResult,
  ReportImageUpload,
  Task,
  UpdatePlanBlockInput,
  UpdateReportMetricsRequest,
  UpdateReportRequest,
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
  profileHydrated: boolean
  profileHydrationError: string | null
  energy: EnergyResult | null
  latestCheckIn: CheckInInput | null
  plan: DayPlan | null
  tasks: Task[]
  nutrition: NutritionPlan | null
  fridge: FridgeItem[]
  coach: CoachReply | null
  reminder: ReminderPreference | null
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
  reloadProfile(): Promise<UserProfile | null | undefined>
  submitCheckIn(input: CheckInInput): Promise<EnergyResult>
  /** Manual score correction — updates energy (and the plan when re-shaped). */
  adjustScore(score: number, note?: string): Promise<void>
  refreshToday(): Promise<void>
  updatePlanBlock(blockId: string, input: UpdatePlanBlockInput): Promise<void>
  regeneratePlan(instruction?: string): Promise<CoachReply>
  /** A conversation turn with the coach — talks only, never rewrites the plan. */
  sendCoachMessage(input: CoachChatRequest): Promise<CoachReply>
  saveReminderPreference(pref: ReminderPreference): Promise<void>
  recognizeFridgeImage(
    image: FridgeImageUpload
  ): Promise<IngredientRecognitionResult>
  saveFridgeItems(items: FridgeItem[]): Promise<void>
  updateFridgeItem(item: FridgeItem): Promise<void>
  deleteFridgeItem(id: string): Promise<void>
  regenerateNutrition(): Promise<void>
  extractReportMetrics(
    image: ReportImageUpload
  ): Promise<ReportExtractionResult>
  getReports(): Promise<HealthReport[]>
  getReport(id: string): Promise<HealthReport>
  saveReport(input: CreateReportRequest): Promise<HealthReport>
  updateReport(id: string, input: UpdateReportRequest): Promise<HealthReport>
  updateReportMetrics(
    id: string,
    input: UpdateReportMetricsRequest
  ): Promise<HealthReport>
  deleteReport(id: string): Promise<void>
  getReportRecommendations(id: string): Promise<HealthRecommendationSet>
  regenerateReportRecommendations(id: string): Promise<HealthRecommendationSet>
  sendReportChatMessage(
    id: string,
    input: ReportChatRequest
  ): Promise<ReportChatReply>
}

const initialState: AppState = {
  profile: null,
  profileHydrated: false,
  profileHydrationError: null,
  energy: null,
  latestCheckIn: null,
  plan: null,
  tasks: [],
  nutrition: null,
  fridge: [],
  coach: null,
  reminder: null,
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

  const reloadProfile = useCallback(async () => {
    refreshRequestId.current += 1
    setState(initialState)
    try {
      const profile = await service.getProfile()
      setState((prev) => ({
        ...prev,
        profile,
        profileHydrated: true,
        profileHydrationError: null,
      }))
      return profile
    } catch (cause) {
      console.error('reloadProfile failed:', cause)
      setState((prev) => ({
        ...prev,
        profileHydrated: true,
        profileHydrationError: 'Could not load your profile. Check your connection and try again.',
      }))
      return undefined
    }
  }, [service])

  useEffect(() => {
    // Initial profile hydration is the intended external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadProfile()
  }, [reloadProfile])

  const completeOnboarding = useCallback(
    async (profile: UserProfile) => {
      const saved = await service.saveProfile(profile)
      setState((prev) => ({
        ...prev,
        profile: saved,
        profileHydrated: true,
        profileHydrationError: null,
      }))
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
      service.getReminderPreference(),
    ])
    let loadedEnergy: EnergyResult | null = null

    try {
      const energy = await energyRequest
      loadedEnergy = energy
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

    const [
      tasksResult,
      planResult,
      nutritionResult,
      coachResult,
      fridgeResult,
      reminderResult,
    ] = await ancillaryRequest
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
      fridge:
        fridgeResult.status === 'fulfilled' ? fridgeResult.value : prev.fridge,
      reminder:
        reminderResult.status === 'fulfilled'
          ? reminderResult.value
          : prev.reminder,
      planLoading: false,
      planError:
        planResult.status === 'rejected'
          ? "Could not load today's plan."
          : planResult.value
            ? null
            : "Today's plan is not ready yet.",
      coachLoading: false,
      coachError:
        coachResult.status === 'rejected'
          ? "Could not load today's coaching note."
          : null,
    }))
    if (reminderResult.status === 'fulfilled' && reminderResult.value) {
      void syncReminderSchedule(reminderResult.value, loadedEnergy !== null)
    }
  }, [service])

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      refreshRequestId.current += 1
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

  const adjustScore = useCallback(
    async (score: number, note?: string) => {
      const date = todayISO()
      const { energy, plan } = await service.adjustEnergyScore(
        date,
        score,
        note
      )
      setState((prev) => ({
        ...prev,
        energy,
        ...(plan ? { plan, ancillaryDate: date, planError: null } : {}),
      }))
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
      return coach
    },
    [service]
  )

  const sendCoachMessage = useCallback(
    (input: CoachChatRequest) => service.sendCoachMessage(todayISO(), input),
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

  const saveReminderPreference = useCallback(
    async (pref: ReminderPreference) => {
      const saved = await service.saveReminderPreference(pref)
      setState((prev) => ({ ...prev, reminder: saved }))
      await syncReminderSchedule(saved, latestRef.current.energy !== null)
    },
    [service]
  )

  const updatePlanBlock = useCallback(
    async (blockId: string, input: UpdatePlanBlockInput) => {
      const plan = await service.updatePlanBlock(todayISO(), blockId, input)
      setState((prev) => ({ ...prev, plan }))
    },
    [service]
  )

  // Reports live on the More tab, not the Today refresh: these are thin
  // passthroughs to the single service instance and the screen owns the list
  // state (mirrors recognizeFridgeImage).
  const extractReportMetrics = useCallback(
    (image: ReportImageUpload) => service.extractReportMetrics(image),
    [service]
  )
  const getReports = useCallback(() => service.getReports(), [service])
  const getReport = useCallback(
    (id: string) => service.getReport(id),
    [service]
  )
  const saveReport = useCallback(
    (input: CreateReportRequest) => service.saveReport(input),
    [service]
  )
  const updateReport = useCallback(
    (id: string, input: UpdateReportRequest) =>
      service.updateReport(id, input),
    [service]
  )
  const updateReportMetrics = useCallback(
    (id: string, input: UpdateReportMetricsRequest) =>
      service.updateReportMetrics(id, input),
    [service]
  )
  const deleteReport = useCallback(
    (id: string) => service.deleteReport(id),
    [service]
  )
  const getReportRecommendations = useCallback(
    (id: string) => service.getReportRecommendations(id),
    [service]
  )
  const regenerateReportRecommendations = useCallback(
    (id: string) => service.regenerateReportRecommendations(id),
    [service]
  )
  const sendReportChatMessage = useCallback(
    (id: string, input: ReportChatRequest) =>
      service.sendReportChatMessage(id, input),
    [service]
  )

  const value = useMemo(
    () => ({
      ...state,
      completeOnboarding,
      reloadProfile,
      submitCheckIn,
      adjustScore,
      refreshToday,
      updatePlanBlock,
      regeneratePlan,
      sendCoachMessage,
      saveReminderPreference,
      recognizeFridgeImage,
      saveFridgeItems,
      updateFridgeItem,
      deleteFridgeItem,
      regenerateNutrition,
      extractReportMetrics,
      getReports,
      getReport,
      saveReport,
      updateReport,
      updateReportMetrics,
      deleteReport,
      getReportRecommendations,
      regenerateReportRecommendations,
      sendReportChatMessage,
    }),
    [
      state,
      completeOnboarding,
      reloadProfile,
      submitCheckIn,
      adjustScore,
      refreshToday,
      updatePlanBlock,
      regeneratePlan,
      sendCoachMessage,
      saveReminderPreference,
      recognizeFridgeImage,
      saveFridgeItems,
      updateFridgeItem,
      deleteFridgeItem,
      regenerateNutrition,
      extractReportMetrics,
      getReports,
      getReport,
      saveReport,
      updateReport,
      updateReportMetrics,
      deleteReport,
      getReportRecommendations,
      regenerateReportRecommendations,
      sendReportChatMessage,
    ]
  )

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider')
  }
  return context
}
