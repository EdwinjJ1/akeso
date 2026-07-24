import type {
  AkesoService,
  ApiResponse,
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
import { Platform } from 'react-native'

import { getAccessToken } from './supabase-client'

const REQUEST_TIMEOUT_MS = 8_000

class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/**
 * Talks to the Express API over HTTPS (TEAM_CONTRACT §4.1: the App never
 * calls Supabase directly). Every method here maps 1:1 to an endpoint in
 * docs/API_CONTRACT.md and must return the exact same shape FixtureService
 * does — see packages/domain/src/service.ts.
 */
export class ApiService implements AkesoService {
  constructor(
    private readonly baseUrl: string,
    private readonly demoMode = false
  ) {}

  private async authorizationHeaders(): Promise<Record<string, string>> {
    if (this.demoMode) return {}
    return { Authorization: `Bearer ${await getAccessToken()}` }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<T> {
    const authorization = await this.authorizationHeaders()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authorization,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      throw new ApiRequestError(
        'NETWORK_ERROR',
        error instanceof Error && error.name === 'AbortError'
          ? `Request timed out: ${method} ${path}`
          : `Network error calling ${method} ${path}`
      )
    } finally {
      clearTimeout(timeout)
    }

    let envelope: ApiResponse<T>
    try {
      envelope = await response.json()
    } catch {
      throw new ApiRequestError('INTERNAL', `Malformed response from ${method} ${path}`)
    }

    if (!envelope.success) {
      // A proxy/gateway can return JSON that isn't our envelope — don't let
      // that surface as a TypeError on `envelope.error.code`.
      throw new ApiRequestError(
        envelope.error?.code ?? 'INTERNAL',
        envelope.error?.message ?? `Unexpected response from ${method} ${path}`
      )
    }
    return envelope.data
  }

  private async upload<T>(path: string, image: FridgeImageUpload): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    const data = new FormData()
    try {
      if (Platform.OS === 'web') {
        const blob = await fetch(image.uri).then((response) => response.blob())
        data.append('image', blob, image.filename)
      } else {
        data.append(
          'image',
          {
            uri: image.uri,
            name: image.filename,
            type: image.mimeType,
          } as unknown as Blob
        )
      }
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: await this.authorizationHeaders(),
        body: data,
        signal: controller.signal,
      })
      const envelope = (await response.json()) as ApiResponse<T>
      if (!envelope.success) {
        throw new ApiRequestError(envelope.error.code, envelope.error.message)
      }
      return envelope.data
    } catch (error) {
      if (error instanceof ApiRequestError) throw error
      throw new ApiRequestError(
        'NETWORK_ERROR',
        error instanceof Error && error.name === 'AbortError'
          ? 'Image recognition timed out. Your edits are still here.'
          : 'Could not upload this image.'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  getProfile(): Promise<UserProfile | null> {
    return this.request('GET', '/v1/profile')
  }

  saveProfile(profile: UserProfile): Promise<UserProfile> {
    return this.request('PUT', '/v1/profile', profile)
  }

  submitCheckIn(input: CheckInInput): Promise<EnergyResult> {
    return this.request('POST', '/v1/checkins', input)
  }

  getCheckIn(date: string): Promise<CheckInInput | null> {
    return this.request('GET', `/v1/checkins/${encodeURIComponent(date)}`)
  }

  getTodayEnergy(date: string): Promise<EnergyResult | null> {
    return this.request('GET', `/v1/energy/${encodeURIComponent(date)}`)
  }

  adjustEnergyScore(
    date: string,
    score: number,
    note?: string
  ): Promise<{ energy: EnergyResult; plan: DayPlan | null }> {
    return this.request(
      'POST',
      `/v1/energy/${encodeURIComponent(date)}/adjust`,
      note === undefined ? { score } : { score, note }
    )
  }

  getTasks(date: string): Promise<Task[]> {
    return this.request('GET', `/v1/tasks?date=${encodeURIComponent(date)}`)
  }

  getTodayPlan(date: string): Promise<DayPlan | null> {
    return this.request('GET', `/v1/plan/${encodeURIComponent(date)}`)
  }

  updatePlanBlock(
    date: string,
    blockId: string,
    input: UpdatePlanBlockInput
  ): Promise<DayPlan> {
    return this.request(
      'PATCH',
      `/v1/plan/${encodeURIComponent(date)}/blocks/${encodeURIComponent(blockId)}`,
      input
    )
  }

  regeneratePlan(
    date: string,
    instruction?: string
  ): Promise<{ plan: DayPlan; coach: CoachReply }> {
    return this.request(
      'POST',
      `/v1/plan/${encodeURIComponent(date)}/regenerate`,
      instruction === undefined ? {} : { instruction }
    )
  }

  getNutritionPlan(date: string): Promise<NutritionPlan | null> {
    return this.request('GET', `/v1/nutrition/${encodeURIComponent(date)}`)
  }

  regenerateNutrition(date: string): Promise<NutritionPlan> {
    return this.request(
      'POST',
      `/v1/nutrition/${encodeURIComponent(date)}/regenerate`,
      undefined,
      20_000
    )
  }

  getCoachReply(date: string): Promise<CoachReply> {
    return this.request('GET', `/v1/coach/${encodeURIComponent(date)}`)
  }

  sendCoachMessage(date: string, input: CoachChatRequest): Promise<CoachReply> {
    // Extended timeout: this call waits on the AI provider round-trip.
    return this.request(
      'POST',
      `/v1/coach/${encodeURIComponent(date)}/chat`,
      input,
      20_000
    )
  }

  getFridgeItems(): Promise<FridgeItem[]> {
    return this.request('GET', '/v1/fridge')
  }

  saveFridgeItem(item: FridgeItem): Promise<FridgeItem> {
    const { id, ...body } = item
    return this.request('PUT', `/v1/fridge/${encodeURIComponent(id)}`, body)
  }

  async deleteFridgeItem(id: string): Promise<void> {
    await this.request('DELETE', `/v1/fridge/${encodeURIComponent(id)}`)
  }

  saveFridgeItemsBatch(items: FridgeItem[]): Promise<FridgeItem[]> {
    return this.request('POST', '/v1/fridge-items/batch', { items })
  }

  recognizeFridgeImage(
    image: FridgeImageUpload
  ): Promise<IngredientRecognitionResult> {
    return this.upload('/v1/fridge/recognitions', image)
  }

  extractReportMetrics(
    image: ReportImageUpload
  ): Promise<ReportExtractionResult> {
    return this.upload('/v1/reports/extractions', image)
  }

  getReports(): Promise<HealthReport[]> {
    return this.request('GET', '/v1/reports')
  }

  getReport(id: string): Promise<HealthReport> {
    return this.request('GET', `/v1/reports/${encodeURIComponent(id)}`)
  }

  saveReport(input: CreateReportRequest): Promise<HealthReport> {
    return this.request('POST', '/v1/reports', input)
  }

  updateReport(
    id: string,
    input: UpdateReportRequest
  ): Promise<HealthReport> {
    return this.request(
      'PATCH',
      `/v1/reports/${encodeURIComponent(id)}`,
      input
    )
  }

  updateReportMetrics(
    id: string,
    input: UpdateReportMetricsRequest
  ): Promise<HealthReport> {
    return this.request(
      'PATCH',
      `/v1/reports/${encodeURIComponent(id)}/metrics`,
      input
    )
  }

  async deleteReport(id: string): Promise<void> {
    await this.request('DELETE', `/v1/reports/${encodeURIComponent(id)}`)
  }

  getReportRecommendations(id: string): Promise<HealthRecommendationSet> {
    return this.request(
      'GET',
      `/v1/reports/${encodeURIComponent(id)}/recommendations`
    )
  }

  regenerateReportRecommendations(
    id: string
  ): Promise<HealthRecommendationSet> {
    return this.request(
      'POST',
      `/v1/reports/${encodeURIComponent(id)}/recommendations/regenerate`,
      undefined,
      20_000
    )
  }

  sendReportChatMessage(
    id: string,
    input: ReportChatRequest
  ): Promise<ReportChatReply> {
    return this.request(
      'POST',
      `/v1/reports/${encodeURIComponent(id)}/chat`,
      input,
      20_000
    )
  }

  getReminderPreference(): Promise<ReminderPreference | null> {
    return this.request('GET', '/v1/reminders')
  }

  saveReminderPreference(pref: ReminderPreference): Promise<ReminderPreference> {
    return this.request('PUT', '/v1/reminders', pref)
  }
}
