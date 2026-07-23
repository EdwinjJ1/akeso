import type {
  HealthRecommendation,
  HealthRecommendationBlueprint,
  HealthRecommendationCategory,
  HealthRecommendationProfileContext,
  HealthRecommendationSet,
  HealthReport,
  RecommendationActionCode,
  ReportMetric,
  ReportMetricStatus,
  UserProfile,
} from './types'
import { healthRecommendationProfileContextSchema } from './schemas'

/**
 * The non-diagnostic disclaimer shown with every recommendation set. It must
 * never be dropped: recommendations are general lifestyle information, never
 * a diagnosis, prescription, or instruction to change treatment.
 */
export const REPORT_RECOMMENDATION_DISCLAIMER =
  'Akeso is an energy coach, not a medical device. These are general lifestyle suggestions based on the values you confirmed — they do not diagnose any condition, are not medical advice, and must not be used to start, stop, or change any medication or treatment. Discuss your results with a qualified healthcare professional.'

/**
 * Derive a metric's status strictly from the reference bounds the report
 * itself supplied. When neither bound needed for the comparison is present,
 * the status is `unknown` — a status is never invented from population
 * defaults or a model's opinion. Units are ignored here on purpose: the value
 * and the bounds come off the same report line, so they are already in the
 * same unit and no conversion is ever performed.
 */
export function computeMetricStatus(
  value: number,
  referenceLow: number | null,
  referenceHigh: number | null
): ReportMetricStatus {
  if (referenceLow === null && referenceHigh === null) return 'unknown'
  if (referenceLow !== null && value < referenceLow) return 'low'
  if (referenceHigh !== null && value > referenceHigh) return 'high'
  return 'normal'
}

/**
 * Reduce the full persisted profile to the only structured fields report
 * advice is allowed to use. Constructing a fresh object is intentional:
 * runtime callers cannot smuggle display names, allergy notes, avoid lists,
 * or unknown properties through a type assertion.
 */
export function toHealthRecommendationProfileContext(
  profile: UserProfile | null
): HealthRecommendationProfileContext | null {
  if (!profile) return null
  return healthRecommendationProfileContextSchema.parse({
    goal: profile.goal,
    typicalWake: profile.typicalWake,
    typicalSleep: profile.typicalSleep,
    dietaryPreference: profile.dietaryPreference,
  })
}

/**
 * Return the only metrics that are allowed to influence recommendations.
 * Legacy MVP rows are normalized by the contract parser to `confirmed: true`;
 * new recognition results keep their explicit confirmation state.
 */
export function confirmedReportMetrics(report: HealthReport): ReportMetric[] {
  return report.metrics.filter((metric) => metric.confirmed)
}

/**
 * Strip unconfirmed recognition results before crossing the AI boundary.
 * A saved report is contractually required to contain at least one confirmed
 * metric; the explicit guard keeps unsafe hand-built values from silently
 * producing ungrounded guidance.
 */
export function reportWithConfirmedMetrics(report: HealthReport): HealthReport {
  const metrics = confirmedReportMetrics(report)
  if (metrics.length === 0) {
    throw new Error('Cannot generate recommendations without confirmed metrics')
  }
  return { ...report, metrics }
}

interface RecommendationTemplate {
  category: HealthRecommendationCategory
  title: string
  detail: string
}

/**
 * The ONLY source of user-visible recommendation text.
 *
 * Prompt rules are not a security boundary for medical text, so the AI never
 * returns prose: it returns an action code (see RecommendationActionCode) and
 * the server renders the copy from this fixed table. No template names a
 * condition, interprets a value, or mentions any medication, supplement, or
 * dose — so no action code, including the one used for out-of-range or
 * unknown metrics, can render diagnostic or prescriptive text.
 */
const RECOMMENDATION_TEMPLATES: Record<
  RecommendationActionCode,
  RecommendationTemplate
> = {
  professional_follow_up: {
    category: 'follow_up',
    title: 'Review these results with a professional',
    detail:
      'Some of the values you confirmed fall outside — or have no — listed reference range. A qualified healthcare professional can interpret what they mean for you. This is general information, not a diagnosis.',
  },
  support_sleep: {
    category: 'sleep',
    title: 'Support steady sleep',
    detail:
      'A regular sleep schedule and a calm wind-down routine are safe, general supports for how you feel day to day.',
  },
  support_hydration: {
    category: 'hydration',
    title: 'Stay steadily hydrated',
    detail:
      'Sipping water through the day is a simple, low-risk habit that supports overall wellbeing.',
  },
  support_balanced_meals: {
    category: 'nutrition',
    title: 'Aim for balanced meals',
    detail:
      'Meals built around vegetables, whole grains, protein and healthy fats are a general support for steady energy.',
  },
  support_gentle_movement: {
    category: 'activity',
    title: 'Add gentle movement',
    detail:
      'Light activity such as walking or stretching, at a level that feels comfortable for you, is a safe general support.',
  },
  support_stress: {
    category: 'stress',
    title: 'Make room to de-stress',
    detail:
      'Short breaks, slow breathing, or time outdoors are gentle, everyday ways to manage stress.',
  },
  general_wellbeing: {
    category: 'general',
    title: 'Keep supporting steady energy',
    detail:
      'Regular sleep, steady hydration, balanced meals and gentle movement are safe, general supports for overall wellbeing while you follow up on this report.',
  },
}

const buildProfileRecommendationItems = (
  report: HealthReport,
  profile: HealthRecommendationProfileContext | null
): HealthRecommendationBlueprint['recommendations'] => {
  if (!profile) return []
  const actionCodes = new Set<RecommendationActionCode>()
  actionCodes.add(
    profile.goal === 'fitness'
      ? 'support_gentle_movement'
      : profile.goal === 'balance'
        ? 'support_sleep'
        : 'support_stress'
  )
  if (profile.dietaryPreference !== 'none') {
    actionCodes.add('support_balanced_meals')
  }
  const metricIds = report.metrics.map((metric) => metric.id)
  return Array.from(actionCodes, (actionCode) => ({
    actionCode,
    basedOnMetricIds: metricIds,
  }))
}

/**
 * Render the final, user-visible recommendation set from a text-free blueprint
 * against the persisted confirmed report.
 *
 * The report is the sole source of `reportId`, `metrics`, and every grounding
 * id: any blueprint citation that is not a confirmed metric id is dropped, and
 * a recommendation left with no confirmed ids is discarded entirely. All copy
 * comes from RECOMMENDATION_TEMPLATES, so nothing the AI produced as text — a
 * title, a detail, a provider string, an injected instruction — can ever reach
 * the client. There is always at least one recommendation (a general-wellbeing
 * entry grounded in the whole confirmed set) so the screen is never empty.
 */
export function renderHealthRecommendationSet({
  report,
  blueprint,
  profile = null,
}: {
  report: HealthReport
  blueprint: HealthRecommendationBlueprint
  profile?: HealthRecommendationProfileContext | null
}): HealthRecommendationSet {
  const confirmedReport = reportWithConfirmedMetrics(report)
  const confirmedIds = new Set(
    confirmedReport.metrics.map((metric) => metric.id)
  )
  const allIds = confirmedReport.metrics.map((metric) => metric.id)

  const recommendations: HealthRecommendation[] = []
  const needsProfessionalFollowUp = confirmedReport.metrics
    .filter((metric) => metric.status !== 'normal')
    .map((metric) => metric.id)
  if (needsProfessionalFollowUp.length > 0) {
    const template = RECOMMENDATION_TEMPLATES.professional_follow_up
    recommendations.push({
      id: 'rec-1',
      category: template.category,
      title: template.title,
      detail: template.detail,
      basedOnMetricIds: needsProfessionalFollowUp,
    })
  }
  // Profile-selected actions are server-enforced. A valid provider response
  // cannot silently ignore the allowed profile context; if it returns the same
  // action, the server replaces it with the fully grounded deterministic item.
  const profileItems = buildProfileRecommendationItems(confirmedReport, profile)
  const profileActionCodes = new Set(profileItems.map((item) => item.actionCode))
  const effectiveItems = [
    ...blueprint.recommendations.filter(
      (item) => !profileActionCodes.has(item.actionCode)
    ),
    ...profileItems,
  ]
  for (const item of effectiveItems) {
    // Follow-up is determined entirely from server-computed statuses above.
    // A provider cannot omit it for a flagged/unknown metric or add an
    // alarming follow-up for a report whose confirmed metrics are all normal.
    if (item.actionCode === 'professional_follow_up') continue
    const grounded = Array.from(
      new Set(item.basedOnMetricIds.filter((id) => confirmedIds.has(id)))
    )
    if (grounded.length === 0) continue
    const template = RECOMMENDATION_TEMPLATES[item.actionCode]
    recommendations.push({
      id: `rec-${recommendations.length + 1}`,
      category: template.category,
      title: template.title,
      detail: template.detail,
      basedOnMetricIds: grounded,
    })
  }

  if (recommendations.length === 0) {
    const template = RECOMMENDATION_TEMPLATES.general_wellbeing
    recommendations.push({
      id: 'rec-1',
      category: template.category,
      title: template.title,
      detail: template.detail,
      basedOnMetricIds: allIds,
    })
  }

  return {
    reportId: report.id,
    metrics: confirmedReport.metrics,
    recommendations,
    disclaimer: REPORT_RECOMMENDATION_DISCLAIMER,
  }
}

/**
 * A conservative, deterministic blueprint used whenever the AI path is
 * unavailable or its output fails validation. Flagged (low/high) and
 * unknown-range metrics get a professional-follow-up action; the whole
 * confirmed set gets a general-wellbeing action. Only action codes and
 * confirmed metric ids — never any free text.
 */
export function buildReportRecommendationBlueprint({
  report,
  profile = null,
}: {
  report: HealthReport
  profile?: HealthRecommendationProfileContext | null
}): HealthRecommendationBlueprint {
  const confirmedReport = reportWithConfirmedMetrics(report)
  const needsFollowUp = confirmedReport.metrics.filter(
    (metric) =>
      metric.status === 'low' ||
      metric.status === 'high' ||
      metric.status === 'unknown'
  )
  const recommendations: HealthRecommendationBlueprint['recommendations'] = []
  if (needsFollowUp.length > 0) {
    recommendations.push({
      actionCode: 'professional_follow_up',
      basedOnMetricIds: needsFollowUp.map((metric) => metric.id),
    })
  }

  // Profile data can only select from the same closed, non-diagnostic action
  // codes. It never changes copy and every selected action remains grounded in
  // the report's confirmed metrics. Goal/diet mappings are intentionally
  // conservative general-wellbeing priorities, not interpretations of a lab.
  recommendations.push(...buildProfileRecommendationItems(report, profile))
  recommendations.push({
    actionCode: 'general_wellbeing',
    basedOnMetricIds: confirmedReport.metrics.map((metric) => metric.id),
  })
  return { recommendations }
}

/**
 * The safe deterministic recommendation set: the deterministic blueprint above
 * rendered through the trusted templates. Used whenever there is no cached AI
 * set to show. Every recommendation cites only confirmed metric ids and there
 * is always at least one, so the screen is never empty.
 */
export function buildReportRecommendationsFallback({
  report,
  profile = null,
}: {
  report: HealthReport
  profile?: HealthRecommendationProfileContext | null
}): HealthRecommendationSet {
  return renderHealthRecommendationSet({
    report,
    blueprint: buildReportRecommendationBlueprint({ report, profile }),
    profile,
  })
}
