import type {
  AkesoService,
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  NutritionPlan,
} from '@akeso/domain'

/** The slice of the service the check-in flow depends on. */
export type CheckInFlowService = Pick<
  AkesoService,
  'submitCheckIn' | 'getTodayPlan' | 'getNutritionPlan' | 'getCoachReply'
>

/** A partial update merged into the app state by the caller. */
export interface AppStatePatch {
  energy?: EnergyResult
  latestCheckIn?: CheckInInput
  plan?: DayPlan | null
  nutrition?: NutritionPlan | null
  coach?: CoachReply | null
  error?: string | null
  ancillaryDate?: string | null
  planLoading?: boolean
  planError?: string | null
  coachLoading?: boolean
  coachError?: string | null
}

const GUIDANCE_FAILED_MESSAGE =
  "Your check-in was saved, but today's guidance could not load. Retry from the dashboard."

/**
 * Two-phase check-in submit, extracted from the provider so it can be tested
 * against a stub service.
 *
 * Phase 1 applies the score as soon as `submitCheckIn` resolves and clears the
 * now-stale plan/nutrition/coach. Phase 2 loads today's guidance; if it fails,
 * the score still stands and only a recoverable error is surfaced.
 *
 * The phase-1 patch deliberately omits `loading` — this flow never sets it, so
 * writing `loading: false` here could clobber an in-flight refreshToday.
 */
export async function runSubmitCheckIn(
  service: CheckInFlowService,
  input: CheckInInput,
  applyPatch: (patch: AppStatePatch) => void
): Promise<EnergyResult> {
  const submittedInput = { ...input }
  const energy = await service.submitCheckIn(input)
  applyPatch({
    energy,
    latestCheckIn: submittedInput,
    plan: null,
    nutrition: null,
    coach: null,
    error: null,
    ancillaryDate: input.date,
    planLoading: true,
    planError: null,
    coachLoading: true,
    coachError: null,
  })

  void loadGuidance(service, input.date, applyPatch)

  return energy
}

async function loadGuidance(
  service: CheckInFlowService,
  date: string,
  applyPatch: (patch: AppStatePatch) => void
) {
  try {
    const [plan, nutrition, coach] = await Promise.all([
      service.getTodayPlan(date),
      service.getNutritionPlan(date),
      service.getCoachReply(date),
    ])
    applyPatch({
      plan,
      nutrition,
      coach,
      ancillaryDate: date,
      planLoading: false,
      planError: null,
      coachLoading: false,
      coachError: null,
    })
  } catch (error) {
    console.error('Post-check-in refresh failed:', error)
    applyPatch({
      ancillaryDate: date,
      planLoading: false,
      planError: GUIDANCE_FAILED_MESSAGE,
      coachLoading: false,
      coachError: GUIDANCE_FAILED_MESSAGE,
    })
  }
}
