import {
  buildReportRecommendationsFallback,
  type HealthReport,
  type ReportExtractionResult,
} from '@akeso/domain'

export const demoReportExtraction: ReportExtractionResult = {
  status: 'ok',
  metrics: [
    {
      name: 'Haemoglobin',
      value: 132,
      unit: 'g/L',
      referenceLow: 120,
      referenceHigh: 160,
      confidence: 0.98,
      uncertaintyReason: null,
    },
    {
      name: 'Ferritin',
      value: 18,
      unit: 'µg/L',
      referenceLow: 30,
      referenceHigh: 200,
      confidence: 0.94,
      uncertaintyReason: null,
    },
    {
      name: 'Vitamin D',
      value: 48,
      unit: 'nmol/L',
      referenceLow: 50,
      referenceHigh: 150,
      confidence: 0.61,
      uncertaintyReason: 'The lower reference bound is faint. Please check the report.',
    },
    {
      name: 'HbA1c',
      value: 5.4,
      unit: '%',
      referenceLow: null,
      referenceHigh: 5.6,
      confidence: 0.97,
      uncertaintyReason: null,
    },
  ],
}

export const demoSavedReport: HealthReport = {
  id: 'demo-health-report',
  name: 'General pathology report',
  reportDate: '2026-07-18',
  createdAt: '2026-07-18T09:30:00.000Z',
  metrics: [
    {
      id: 'demo-haemoglobin',
      name: 'Haemoglobin',
      value: 132,
      unit: 'g/L',
      referenceLow: 120,
      referenceHigh: 160,
      status: 'normal',
      confidence: 0.98,
      uncertaintyReason: null,
      confirmed: true,
    },
    {
      id: 'demo-ferritin',
      name: 'Ferritin',
      value: 18,
      unit: 'µg/L',
      referenceLow: 30,
      referenceHigh: 200,
      status: 'low',
      confidence: 0.94,
      uncertaintyReason: null,
      confirmed: true,
    },
    {
      id: 'demo-vitamin-d',
      name: 'Vitamin D',
      value: 48,
      unit: 'nmol/L',
      referenceLow: 50,
      referenceHigh: 150,
      status: 'low',
      confidence: 0.61,
      uncertaintyReason: 'The lower reference bound is faint. Please check the report.',
      confirmed: false,
    },
  ],
}

export const demoRecommendations = buildReportRecommendationsFallback({
  report: demoSavedReport,
})
