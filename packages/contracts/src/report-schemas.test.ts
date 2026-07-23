import { describe, expect, it } from 'vitest'

import {
  DetectedReportMetricSchema,
  HealthRecommendationBlueprintSchema,
  HealthRecommendationSetSchema,
  RecommendationActionCodeSchema,
  ReportExtractionResultSchema,
} from './schemas'
import { fixtureHealthRecommendationSet, fixtureHealthReport } from './fixtures'

describe('HealthRecommendationSetSchema grounding', () => {
  it('accepts a set whose citations all reference confirmed metric ids', () => {
    expect(() =>
      HealthRecommendationSetSchema.parse(fixtureHealthRecommendationSet)
    ).not.toThrow()
  })

  it('rejects a recommendation that cites a metric id outside the confirmed set', () => {
    const result = HealthRecommendationSetSchema.safeParse({
      ...fixtureHealthRecommendationSet,
      recommendations: [
        {
          id: 'rec-x',
          category: 'general',
          title: 'Ungrounded',
          detail: 'Cites a metric the user never confirmed.',
          basedOnMetricIds: ['not-a-real-metric'],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one grounding id per recommendation', () => {
    const result = HealthRecommendationSetSchema.safeParse({
      ...fixtureHealthRecommendationSet,
      recommendations: [
        {
          id: 'rec-y',
          category: 'general',
          title: 'No grounding',
          detail: 'Has no basedOnMetricIds.',
          basedOnMetricIds: [],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires a disclaimer even when there are no recommendations', () => {
    const withEmpty = HealthRecommendationSetSchema.safeParse({
      reportId: fixtureHealthReport.id,
      metrics: fixtureHealthReport.metrics,
      recommendations: [],
      disclaimer: 'General information only, not medical advice.',
    })
    expect(withEmpty.success).toBe(true)

    const missingDisclaimer = HealthRecommendationSetSchema.safeParse({
      reportId: fixtureHealthReport.id,
      metrics: fixtureHealthReport.metrics,
      recommendations: [],
      disclaimer: '',
    })
    expect(missingDisclaimer.success).toBe(false)
  })
})

describe('HealthRecommendationBlueprintSchema', () => {
  it('accepts a blueprint of closed action codes plus metric ids', () => {
    const result = HealthRecommendationBlueprintSchema.safeParse({
      recommendations: [
        { actionCode: 'professional_follow_up', basedOnMetricIds: ['vitamin-d'] },
        { actionCode: 'general_wellbeing', basedOnMetricIds: ['vitamin-d'] },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an action code outside the closed enum', () => {
    expect(RecommendationActionCodeSchema.safeParse('diagnose').success).toBe(false)
    const result = HealthRecommendationBlueprintSchema.safeParse({
      recommendations: [
        { actionCode: 'diagnose_condition', basedOnMetricIds: ['vitamin-d'] },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects any free-text field the model might try to smuggle in (strict)', () => {
    const result = HealthRecommendationBlueprintSchema.safeParse({
      recommendations: [
        {
          actionCode: 'general_wellbeing',
          basedOnMetricIds: ['vitamin-d'],
          detail: 'You have a serious condition; take medication.',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one grounding id per action', () => {
    const result = HealthRecommendationBlueprintSchema.safeParse({
      recommendations: [{ actionCode: 'general_wellbeing', basedOnMetricIds: [] }],
    })
    expect(result.success).toBe(false)
  })
})

describe('DetectedReportMetricSchema', () => {
  const valid = {
    name: 'Hemoglobin',
    value: 14.2,
    unit: 'g/dL',
    referenceLow: 13.5,
    referenceHigh: 17.5,
    confidence: 0.9,
    uncertaintyReason: null,
  }

  it('accepts a legible detected metric with numeric bounds or nulls', () => {
    expect(DetectedReportMetricSchema.safeParse(valid).success).toBe(true)
    expect(
      DetectedReportMetricSchema.safeParse({
        ...valid,
        referenceLow: null,
        referenceHigh: null,
      }).success
    ).toBe(true)
  })

  it('rejects a model-asserted id or status (those are server-assigned)', () => {
    expect(
      DetectedReportMetricSchema.safeParse({ ...valid, id: 'hemoglobin' }).success
    ).toBe(false)
    expect(
      DetectedReportMetricSchema.safeParse({ ...valid, status: 'high' }).success
    ).toBe(false)
  })
})

describe('ReportExtractionResultSchema', () => {
  it('requires at least one metric for an ok result', () => {
    expect(
      ReportExtractionResultSchema.safeParse({ status: 'ok', metrics: [] }).success
    ).toBe(false)
  })

  it('requires an empty metric list and known reason for an empty result', () => {
    expect(
      ReportExtractionResultSchema.safeParse({
        status: 'empty',
        metrics: [],
        reason: 'no_metrics_detected',
      }).success
    ).toBe(true)
    expect(
      ReportExtractionResultSchema.safeParse({
        status: 'empty',
        metrics: [],
        reason: 'made_up_reason',
      }).success
    ).toBe(false)
  })

  it('carries a free-text reason for a refused result', () => {
    expect(
      ReportExtractionResultSchema.safeParse({
        status: 'refused',
        metrics: [],
        reason: 'policy',
      }).success
    ).toBe(true)
  })
})
