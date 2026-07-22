import {
  HealthRecommendationSetSchema,
  ReportMetricSchema,
} from '@akeso/contracts'
import { describe, expect, it } from 'vitest'

import {
  buildReportRecommendationBlueprint,
  buildReportRecommendationsFallback,
  computeMetricStatus,
  renderHealthRecommendationSet,
  REPORT_RECOMMENDATION_DISCLAIMER,
} from './report'
import type {
  HealthRecommendationBlueprint,
  HealthReport,
  ReportMetric,
} from './types'

const metric = (over: Partial<ReportMetric>): ReportMetric => ({
  id: 'm',
  name: 'Metric',
  value: 1,
  unit: '',
  referenceLow: null,
  referenceHigh: null,
  status: 'unknown',
  ...over,
})

const report = (metrics: ReportMetric[]): HealthReport => ({
  id: 'report-1',
  createdAt: '2026-07-22T09:00:00+10:00',
  metrics,
})

describe('computeMetricStatus', () => {
  it('is unknown when neither bound is present — never invented', () => {
    expect(computeMetricStatus(42, null, null)).toBe('unknown')
  })

  it('flags low/high strictly against the supplied bounds', () => {
    expect(computeMetricStatus(10, 13.5, 17.5)).toBe('low')
    expect(computeMetricStatus(20, 13.5, 17.5)).toBe('high')
    expect(computeMetricStatus(15, 13.5, 17.5)).toBe('normal')
  })

  it('treats the bounds as inclusive (a value on the bound is normal)', () => {
    expect(computeMetricStatus(13.5, 13.5, 17.5)).toBe('normal')
    expect(computeMetricStatus(17.5, 13.5, 17.5)).toBe('normal')
  })

  it('uses only the bound that is present when the other is missing', () => {
    // Low bound only: below is low, at/above is normal (never "high").
    expect(computeMetricStatus(5, 10, null)).toBe('low')
    expect(computeMetricStatus(50, 10, null)).toBe('normal')
    // High bound only: above is high, at/below is normal (never "low").
    expect(computeMetricStatus(200, null, 100)).toBe('high')
    expect(computeMetricStatus(50, null, 100)).toBe('normal')
  })
})

describe('buildReportRecommendationsFallback', () => {
  it('grounds every recommendation in confirmed metric ids only', () => {
    const set = buildReportRecommendationsFallback({
      report: report([
        metric({ id: 'vitamin-d', name: 'Vitamin D', value: 18, referenceLow: 30, referenceHigh: 100, status: 'low' }),
        metric({ id: 'ferritin', name: 'Ferritin', value: 42, status: 'unknown' }),
        metric({ id: 'hemoglobin', name: 'Hemoglobin', value: 14.2, referenceLow: 13.5, referenceHigh: 17.5, status: 'normal' }),
      ]),
    })

    const confirmedIds = new Set(['vitamin-d', 'ferritin', 'hemoglobin'])
    for (const rec of set.recommendations) {
      expect(rec.basedOnMetricIds.length).toBeGreaterThan(0)
      for (const id of rec.basedOnMetricIds) {
        expect(confirmedIds.has(id)).toBe(true)
      }
    }
    // The schema's superRefine independently rejects any ungrounded citation.
    expect(() => HealthRecommendationSetSchema.parse(set)).not.toThrow()
  })

  it('always carries the non-diagnostic disclaimer', () => {
    const set = buildReportRecommendationsFallback({
      report: report([metric({ id: 'a', status: 'normal', referenceLow: 0, referenceHigh: 10 })]),
    })
    expect(set.disclaimer).toBe(REPORT_RECOMMENDATION_DISCLAIMER)
  })

  it('always returns at least one recommendation, even when nothing is flagged', () => {
    const set = buildReportRecommendationsFallback({
      report: report([metric({ id: 'a', status: 'normal', referenceLow: 0, referenceHigh: 10 })]),
    })
    expect(set.recommendations.length).toBeGreaterThan(0)
  })

  it('routes flagged and unknown-range metrics to professional follow-up', () => {
    const set = buildReportRecommendationsFallback({
      report: report([
        metric({ id: 'ferritin', name: 'Ferritin', status: 'unknown' }),
      ]),
    })
    const followUp = set.recommendations.find((rec) => rec.category === 'follow_up')
    expect(followUp).toBeDefined()
    expect(followUp?.basedOnMetricIds).toEqual(['ferritin'])
    // No fabricated numbers or invented range appear anywhere in the copy.
    const text = set.recommendations.map((rec) => rec.detail).join(' ')
    expect(text).not.toMatch(/\d/)
  })

  it('never prescribes medication or a treatment change', () => {
    const set = buildReportRecommendationsFallback({
      report: report([
        metric({ id: 'vitamin-d', name: 'Vitamin D', value: 18, referenceLow: 30, referenceHigh: 100, status: 'low' }),
      ]),
    })
    const text = set.recommendations
      .map((rec) => `${rec.title} ${rec.detail}`)
      .join(' ')
      .toLowerCase()
    // No prescriptive/medication/dosing instructions in the suggestions.
    for (const banned of ['prescri', 'medication', 'supplement', 'dose', ' mg']) {
      expect(text).not.toContain(banned)
    }
    // The disclaimer must affirm the non-diagnostic, non-medical-advice framing.
    expect(set.disclaimer.toLowerCase()).toContain('not a medical device')
    expect(set.disclaimer.toLowerCase()).toContain('medication')
  })
})

describe('buildReportRecommendationBlueprint', () => {
  it('emits professional_follow_up for low/high/unknown and general_wellbeing always', () => {
    const blueprint = buildReportRecommendationBlueprint({
      report: report([
        metric({ id: 'vitamin-d', status: 'low', referenceLow: 30, referenceHigh: 100, value: 18 }),
        metric({ id: 'ferritin', status: 'unknown' }),
        metric({ id: 'hemoglobin', status: 'normal', referenceLow: 13.5, referenceHigh: 17.5, value: 14.2 }),
      ]),
    })
    const followUp = blueprint.recommendations.find(
      (rec) => rec.actionCode === 'professional_follow_up'
    )
    expect(followUp?.basedOnMetricIds).toEqual(['vitamin-d', 'ferritin'])
    expect(
      blueprint.recommendations.some((rec) => rec.actionCode === 'general_wellbeing')
    ).toBe(true)
  })

  it('omits professional follow-up when every metric is normal', () => {
    const blueprint = buildReportRecommendationBlueprint({
      report: report([
        metric({ id: 'a', status: 'normal', referenceLow: 0, referenceHigh: 10, value: 5 }),
      ]),
    })
    expect(
      blueprint.recommendations.every((rec) => rec.actionCode === 'general_wellbeing')
    ).toBe(true)
  })
})

describe('renderHealthRecommendationSet', () => {
  const confirmed = report([
    metric({ id: 'vitamin-d', name: 'Vitamin D', status: 'low', referenceLow: 30, referenceHigh: 100, value: 18 }),
  ])

  it('renders title/detail only from fixed templates, never from the blueprint', () => {
    const blueprint: HealthRecommendationBlueprint = {
      recommendations: [
        { actionCode: 'general_wellbeing', basedOnMetricIds: ['vitamin-d'] },
      ],
    }
    const set = renderHealthRecommendationSet({ report: confirmed, blueprint })
    expect(set.recommendations[0].title).toBe('Keep supporting steady energy')
    expect(set.reportId).toBe('report-1')
    expect(set.metrics).toEqual(confirmed.metrics)
    expect(set.disclaimer).toBe(REPORT_RECOMMENDATION_DISCLAIMER)
  })

  it('drops citations that are not confirmed metric ids', () => {
    const blueprint: HealthRecommendationBlueprint = {
      recommendations: [
        { actionCode: 'general_wellbeing', basedOnMetricIds: ['vitamin-d', 'phantom'] },
      ],
    }
    const set = renderHealthRecommendationSet({ report: confirmed, blueprint })
    expect(set.recommendations[0].basedOnMetricIds).toEqual(['vitamin-d'])
    expect(JSON.stringify(set)).not.toContain('phantom')
  })

  it('drops a recommendation grounded only in unknown ids, staying non-empty', () => {
    const blueprint: HealthRecommendationBlueprint = {
      recommendations: [
        { actionCode: 'professional_follow_up', basedOnMetricIds: ['phantom-only'] },
      ],
    }
    const set = renderHealthRecommendationSet({ report: confirmed, blueprint })
    // The ungrounded rec is dropped; a general-wellbeing entry backfills it.
    expect(set.recommendations.length).toBeGreaterThan(0)
    for (const rec of set.recommendations) {
      expect(rec.basedOnMetricIds).toEqual(['vitamin-d'])
    }
    expect(() => HealthRecommendationSetSchema.parse(set)).not.toThrow()
  })
})

describe('ReportMetricSchema', () => {
  it('rejects unknown fields (strict) so a spoofed status cannot slip through', () => {
    const result = ReportMetricSchema.safeParse({
      id: 'a',
      name: 'A',
      value: 1,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
      status: 'normal',
      injected: 'high',
    })
    expect(result.success).toBe(false)
  })
})
