import type { CoachReply, DayPlan } from '@akeso/domain'

const COACH_DISCLAIMER =
  'Akeso is an energy coach, not a medical device. Suggestions are based on your own check-ins and plan, not clinical measurements.'

/**
 * Builds a coach response only from the user's persisted plan. This is the
 * honest fallback until a validated AI coach is available: no fictional
 * suggestions or sample check-in data are substituted.
 */
export function buildCoachReplyFromPlan(plan: DayPlan): CoachReply {
  return {
    message: plan.coachNote,
    suggestions: [],
    adjustedPlan: plan,
    disclaimer: COACH_DISCLAIMER,
  }
}
