import {
  applyScoreAdjustment,
  buildInventoryNutritionFallback,
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureTasks,
  filterNutritionPlanForDietarySafety,
  buildReportRecommendationsFallback,
  computeMetricStatus,
  EnergyEngine,
  mergeRegeneratedPlan,
  planDay,
  toHealthRecommendationProfileContext,
  updatePlanBlock as applyPlanBlockUpdate,
  type AkesoService,
  type CheckInInput,
  type CoachChatRequest,
  type CoachReply,
  type CreateReportRequest,
  type DayPlan,
  type EnergyResult,
  type FridgeImageUpload,
  type FridgeItem,
  type HealthReport,
  type HealthRecommendationSet,
  type IngredientRecognitionResult,
  type NutritionPlan,
  type ReminderPreference,
  type ReportChatReply,
  type ReportChatRequest,
  type ReportExtractionResult,
  type ReportImageUpload,
  REPORT_CHAT_DISCLAIMER,
  type Task,
  type UpdatePlanBlockInput,
  type UpdateReportMetricsRequest,
  type UpdateReportRequest,
  type UserProfile,
  userProfileSchema,
} from '@akeso/domain'

import {
  demoReportExtraction,
  demoSavedReport,
  getReportFixtureScenarioForUpload,
} from '../components/report/report-demo'

const LATENCY_MS = 450
const PROFILE_STORAGE_KEY = 'akeso.demo.profile.v1'

interface ProfileStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

const wait = (ms: number) =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Demo-only in-memory service.  It delegates all score calculation to the
 * shared deterministic engine so UI fixtures never carry a second set of
 * scoring weights.  Production API requests use this same engine server-side.
 */
const energyEngine = new EnergyEngine()

export class FixtureService implements AkesoService {
  private profile: UserProfile | null = null
  private energy: EnergyResult | null = null
  private plan: DayPlan | null = null
  constructor(
    private readonly latencyMs = LATENCY_MS,
    private readonly profileStorage?: ProfileStorage
  ) {}
  private latestCheckIn: CheckInInput | null = null
  private fridge = new Map<string, FridgeItem>()
  private reminder: ReminderPreference | null = null
  private reports = new Map<string, HealthReport>([
    [demoSavedReport.id, demoSavedReport],
  ])
  private pendingReportFixtureRetries = new Set<string>()
  private reportSequence = 1

  async getProfile(): Promise<UserProfile | null> {
    await wait(this.latencyMs / 3)
    if (!this.profile && this.profileStorage) {
      const stored = await this.profileStorage.getItem(PROFILE_STORAGE_KEY)
      if (stored) {
        try {
          const parsed = userProfileSchema.safeParse(JSON.parse(stored))
          if (parsed.success) this.profile = parsed.data
        } catch {
          // Ignore malformed local demo data and let onboarding replace it.
        }
      }
    }
    return this.profile
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await wait(this.latencyMs / 3)
    this.profile = profile
    await this.profileStorage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    return profile
  }

  async submitCheckIn(input: CheckInInput): Promise<EnergyResult> {
    await wait(this.latencyMs * 2)
    this.latestCheckIn = input
    this.energy = energyEngine.evaluate(input)
    return this.energy
  }

  async getTodayEnergy(date: string): Promise<EnergyResult | null> {
    await wait(this.latencyMs / 3)
    return this.energy && this.energy.date === date ? this.energy : null
  }

  async adjustEnergyScore(
    date: string,
    score: number,
    note?: string
  ): Promise<{ energy: EnergyResult; plan: DayPlan | null }> {
    await wait(this.latencyMs / 2)
    if (!this.energy || this.energy.date !== date) {
      throw new Error(
        `No check-in for ${date} yet — submit one before adjusting the score.`
      )
    }
    // Same domain function the API runs, so demo mode behaves identically.
    this.energy = applyScoreAdjustment(this.energy, score, {
      note,
      adjustedAt: new Date().toISOString(),
    })
    if (this.plan) {
      this.plan = mergeRegeneratedPlan(
        planDay(this.energy, fixtureTasks),
        this.plan
      )
    }
    return { energy: this.energy, plan: this.plan }
  }

  async getTasks(_date: string): Promise<Task[]> {
    await wait(this.latencyMs / 2)
    return fixtureTasks
  }

  async getTodayPlan(date: string): Promise<DayPlan | null> {
    await wait(this.latencyMs)
    if (!this.energy) return null
    if (!this.plan || this.plan.date !== date) {
      this.plan = { ...fixtureDayPlan, date }
    }
    return this.plan
  }

  async updatePlanBlock(
    date: string,
    blockId: string,
    input: UpdatePlanBlockInput
  ): Promise<DayPlan> {
    await wait(this.latencyMs)
    const plan = await this.getTodayPlan(date)
    if (!plan) throw new Error(`No plan exists for ${date}`)
    this.plan = applyPlanBlockUpdate(plan, blockId, input)
    return this.plan
  }

  async regeneratePlan(
    date: string,
    _instruction?: string
  ): Promise<{ plan: DayPlan; coach: CoachReply }> {
    await wait(this.latencyMs * 3)
    const freshPlan: DayPlan = {
      ...fixtureDayPlan,
      date,
      generatedAt: new Date().toISOString(),
      coachNote:
        'Plan refreshed: same protected morning peak, with the afternoon rebalanced around your current stress level.',
    }
    this.plan = this.plan
      ? mergeRegeneratedPlan(freshPlan, this.plan)
      : freshPlan
    return {
      plan: this.plan,
      coach: fixtureCoachReply,
    }
  }

  private buildNutrition(date: string): NutritionPlan {
    const plan = buildInventoryNutritionFallback({
      date,
      fridge: Array.from(this.fridge.values()),
      energyBand: this.energy?.band ?? 'moderate',
      dietaryPreference: this.profile?.dietaryPreference ?? 'none',
      needs: [],
    })
    return filterNutritionPlanForDietarySafety(
      plan,
      this.profile?.dietarySafety
    )
  }

  async getNutritionPlan(date: string): Promise<NutritionPlan | null> {
    await wait(this.latencyMs)
    return this.buildNutrition(date)
  }

  async regenerateNutrition(date: string): Promise<NutritionPlan> {
    await wait(LATENCY_MS)
    return this.buildNutrition(date)
  }

  async getCoachReply(_date: string): Promise<CoachReply> {
    await wait(this.latencyMs)
    return fixtureCoachReply
  }

  /**
   * Demo-mode chat: no AI available offline, so the reply is DERIVED from
   * the user's current in-memory data (energy headline, plan note, their
   * note) — the same honest-degradation shape the API uses, never a canned
   * fake conversation.
   */
  async sendCoachMessage(
    _date: string,
    input: CoachChatRequest
  ): Promise<CoachReply> {
    await wait(this.latencyMs)
    if (!this.energy) {
      return {
        message:
          'Complete today’s 20-second check-in first, then I can talk about your actual day.',
        suggestions: [],
        disclaimer: fixtureCoachReply.disclaimer,
      }
    }
    if (input.intent === 'opener') {
      return {
        message:
          'One quick question so I read today right: how is your mood and stress level, and is there anything about food or sleep I should know?',
        suggestions: [],
        disclaimer: fixtureCoachReply.disclaimer,
      }
    }
    const acknowledgement =
      input.intent === 'more'
        ? 'Noted — I’ll keep that in mind for today. '
        : ''
    const parts = [
      `${acknowledgement}Here's what today's data says: ${this.energy.headline}`,
      ...(this.plan ? [this.plan.coachNote] : []),
      'Connect the live API for full AI coaching.',
    ]
    return {
      message: parts.join(' '),
      suggestions: [],
      ...(this.plan ? { adjustedPlan: this.plan } : {}),
      disclaimer: fixtureCoachReply.disclaimer,
    }
  }

  async getFridgeItems(): Promise<FridgeItem[]> {
    await wait(LATENCY_MS / 3)
    return Array.from(this.fridge.values())
  }

  async saveFridgeItem(item: FridgeItem): Promise<FridgeItem> {
    await wait(LATENCY_MS / 3)
    this.fridge.set(item.id, item)
    return item
  }

  async deleteFridgeItem(id: string): Promise<void> {
    await wait(LATENCY_MS / 3)
    this.fridge.delete(id)
  }

  async saveFridgeItemsBatch(items: FridgeItem[]): Promise<FridgeItem[]> {
    await wait(LATENCY_MS / 3)
    items.forEach((item) => this.fridge.set(item.id, item))
    return items
  }

  async recognizeFridgeImage(
    _image: FridgeImageUpload
  ): Promise<IngredientRecognitionResult> {
    throw new Error(
      'Live fridge recognition requires EXPO_PUBLIC_API_URL. Manual entry is available.'
    )
  }

  async extractReportMetrics(
    image: ReportImageUpload
  ): Promise<ReportExtractionResult> {
    await wait(this.latencyMs * 2)
    const fixture = getReportFixtureScenarioForUpload(image)
    if (!fixture) return demoReportExtraction
    if (
      fixture.firstAttemptError &&
      !this.pendingReportFixtureRetries.has(fixture.id)
    ) {
      this.pendingReportFixtureRetries.add(fixture.id)
      throw new Error(fixture.firstAttemptError)
    }
    this.pendingReportFixtureRetries.delete(fixture.id)
    return fixture.extraction
  }

  async getReports(): Promise<HealthReport[]> {
    await wait(this.latencyMs / 3)
    return Array.from(this.reports.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )
  }

  async getReport(id: string): Promise<HealthReport> {
    await wait(this.latencyMs / 3)
    const report = this.reports.get(id)
    if (!report) throw new Error('Report not found.')
    return report
  }

  async saveReport(input: CreateReportRequest): Promise<HealthReport> {
    await wait(this.latencyMs)
    const metrics = input.metrics.map((metric) => ({
      ...metric,
      status: computeMetricStatus(
        metric.value,
        metric.referenceLow,
        metric.referenceHigh
      ),
    }))
    this.reportSequence += 1
    const report: HealthReport = {
      id: `report-${this.reportSequence}`,
      name: input.name,
      reportDate: input.reportDate,
      createdAt: new Date().toISOString(),
      metrics,
    }
    this.reports.set(report.id, report)
    return report
  }

  async updateReport(
    id: string,
    input: UpdateReportRequest
  ): Promise<HealthReport> {
    await wait(this.latencyMs / 3)
    const report = this.reports.get(id)
    if (!report) throw new Error('Report not found.')
    const updated = { ...report, ...input }
    this.reports.set(id, updated)
    return updated
  }

  async updateReportMetrics(
    id: string,
    input: UpdateReportMetricsRequest
  ): Promise<HealthReport> {
    await wait(this.latencyMs / 3)
    const report = this.reports.get(id)
    if (!report) throw new Error('Report not found.')
    const metrics = input.metrics.map((metric) => ({
      ...metric,
      status: computeMetricStatus(
        metric.value,
        metric.referenceLow,
        metric.referenceHigh
      ),
    }))
    const updated = { ...report, metrics }
    this.reports.set(id, updated)
    return updated
  }

  async deleteReport(id: string): Promise<void> {
    await wait(this.latencyMs / 3)
    if (!this.reports.has(id)) throw new Error('Report not found.')
    this.reports.delete(id)
  }

  async getReportRecommendations(id: string): Promise<HealthRecommendationSet> {
    await wait(this.latencyMs)
    return this.recommendationsFor(id)
  }

  async regenerateReportRecommendations(
    id: string
  ): Promise<HealthRecommendationSet> {
    await wait(this.latencyMs)
    return this.recommendationsFor(id)
  }

  async sendReportChatMessage(
    id: string,
    input: ReportChatRequest
  ): Promise<ReportChatReply> {
    await wait(this.latencyMs)
    const report = this.reports.get(id)
    if (!report) throw new Error('Report not found.')
    const confirmed = report.metrics.filter((metric) => metric.confirmed)
    const flagged = confirmed.filter(
      (metric) => metric.status === 'low' || metric.status === 'high'
    )
    const focus =
      flagged.length > 0
        ? `Looking at your confirmed values, ${flagged
            .slice(0, 2)
            .map((metric) => metric.name)
            .join(' and ')} sit outside the reference range, so gentle, food-first adjustments there are a sensible place to start.`
        : 'Your confirmed values all sit within their reference ranges, so a varied, balanced routine is the main thing to keep up.'
    return {
      message: `Thanks for asking about “${input.message.slice(0, 80)}”. ${focus} Regular meals with vegetables, whole grains, legumes or lean protein, and steady hydration support most goals.`,
      disclaimer: REPORT_CHAT_DISCLAIMER,
    }
  }

  private recommendationsFor(id: string): HealthRecommendationSet {
    const report = this.reports.get(id)
    if (!report) throw new Error('Report not found.')
    return buildReportRecommendationsFallback({
      report,
      profile: toHealthRecommendationProfileContext(this.profile),
    })
  }

  async getReminderPreference(): Promise<ReminderPreference | null> {
    await wait(LATENCY_MS / 3)
    return this.reminder
  }

  async saveReminderPreference(
    pref: ReminderPreference
  ): Promise<ReminderPreference> {
    await wait(LATENCY_MS / 3)
    this.reminder = pref
    return pref
  }
}
