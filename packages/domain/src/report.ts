import type {
  HealthRecommendation,
  HealthRecommendationBlueprint,
  HealthRecommendationCategory,
  HealthRecommendationSet,
  HealthReport,
  RecommendationActionCode,
  ReportMetricStatus,
} from './types'

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
}: {
  report: HealthReport
  blueprint: HealthRecommendationBlueprint
}): HealthRecommendationSet {
  const confirmedIds = new Set(report.metrics.map((metric) => metric.id))
  const allIds = report.metrics.map((metric) => metric.id)

  const recommendations: HealthRecommendation[] = []
  for (const item of blueprint.recommendations) {
    const grounded = item.basedOnMetricIds.filter((id) => confirmedIds.has(id))
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
    metrics: report.metrics,
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
}: {
  report: HealthReport
}): HealthRecommendationBlueprint {
  const needsFollowUp = report.metrics.filter(
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
  recommendations.push({
    actionCode: 'general_wellbeing',
    basedOnMetricIds: report.metrics.map((metric) => metric.id),
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
}: {
  report: HealthReport
}): HealthRecommendationSet {
  return renderHealthRecommendationSet({
    report,
    blueprint: buildReportRecommendationBlueprint({ report }),
  })
}
