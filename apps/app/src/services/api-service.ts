import type {
  AkesoService,
  ApiResponse,
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  FridgeItem,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

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
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await getAccessToken()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
      throw new ApiRequestError(envelope.error.code, envelope.error.message)
    }
    return envelope.data
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

  getTodayEnergy(date: string): Promise<EnergyResult | null> {
    return this.request('GET', `/v1/energy/${encodeURIComponent(date)}`)
  }

  getTasks(date: string): Promise<Task[]> {
    return this.request('GET', `/v1/tasks?date=${encodeURIComponent(date)}`)
  }

  getTodayPlan(date: string): Promise<DayPlan | null> {
    return this.request('GET', `/v1/plan/${encodeURIComponent(date)}`)
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

  getCoachReply(date: string): Promise<CoachReply> {
    return this.request('GET', `/v1/coach/${encodeURIComponent(date)}`)
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

  getReminderPreference(): Promise<ReminderPreference | null> {
    return this.request('GET', '/v1/reminders')
  }

  saveReminderPreference(pref: ReminderPreference): Promise<ReminderPreference> {
    return this.request('PUT', '/v1/reminders', pref)
  }
}
