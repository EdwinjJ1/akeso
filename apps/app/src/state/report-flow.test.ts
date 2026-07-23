import { describe, expect, test } from 'vitest'
import type { ReportExtractionResult } from '@akeso/domain'

import {
  addManualMetricCandidate,
  addBlankManualMetricCandidate,
  candidateStatus,
  candidatesFromExtraction,
  candidatesFromReportMetrics,
  editMetricCandidate,
  hasInvalidConfirmedCandidates,
  hasDuplicateReportCandidates,
  hasInvalidReportCandidates,
  parseRequiredMetricNumber,
  removeMetricCandidate,
  toConfirmedReportMetrics,
  toReviewedReportMetrics,
  toggleMetricCandidate,
  type ReportMetricCandidate,
} from './report-flow'

const extraction: ReportExtractionResult = {
  status: 'ok',
  metrics: [
    {
      name: 'Vitamin D (25-OH)',
      value: 18,
      unit: 'ng/mL',
      referenceLow: 30,
      referenceHigh: 100,
      confidence: 0.9,
      uncertaintyReason: null,
    },
    {
      name: 'Ferritin',
      value: 42,
      unit: 'ng/mL',
      referenceLow: null,
      referenceHigh: null,
      confidence: 0.7,
      uncertaintyReason: 'range not printed',
    },
  ],
}

describe('candidatesFromExtraction', () => {
  test('maps ok metrics to unconfirmed candidates', () => {
    const candidates = candidatesFromExtraction(extraction)
    expect(candidates).toHaveLength(2)
    expect(candidates.every((candidate) => !candidate.confirmed)).toBe(true)
  })

  test('yields nothing for empty/refused extractions (never fabricates)', () => {
    expect(
      candidatesFromExtraction({
        status: 'empty',
        metrics: [],
        reason: 'no_metrics_detected',
      })
    ).toEqual([])
    expect(
      candidatesFromExtraction({ status: 'refused', metrics: [], reason: 'policy' })
    ).toEqual([])
  })
})

describe('candidateStatus', () => {
  test('derives status from the bounds; unknown when no range', () => {
    const [vitaminD, ferritin] = candidatesFromExtraction(extraction)
    expect(candidateStatus(vitaminD)).toBe('low')
    expect(candidateStatus(ferritin)).toBe('unknown')
  })
})

describe('toConfirmedReportMetrics', () => {
  test('persists only confirmed candidates with a server-recomputed status', () => {
    let candidates = candidatesFromExtraction(extraction)
    candidates = toggleMetricCandidate(candidates, candidates[0].localId)
    const metrics = toConfirmedReportMetrics(candidates)
    expect(metrics).toHaveLength(1)
    expect(metrics[0].name).toBe('Vitamin D (25-OH)')
    expect(metrics[0].status).toBe('low')
    // A stable, slugged id is assigned client-side.
    expect(metrics[0].id).toBe('vitamin-d-25-oh')
  })

  test('deduplicates by normalized name, dropping later confirmed duplicates', () => {
    let candidates: ReportMetricCandidate[] = addManualMetricCandidate([], {
      name: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      referenceLow: 13.5,
      referenceHigh: 17.5,
    })
    candidates = toggleMetricCandidate(candidates, candidates[0].localId)
    candidates = addManualMetricCandidate(candidates, {
      name: '  hemoglobin ',
      value: 99,
      unit: 'g/dL',
      referenceLow: 13.5,
      referenceHigh: 17.5,
    })
    candidates = toggleMetricCandidate(candidates, candidates[1].localId)
    const metrics = toConfirmedReportMetrics(candidates)
    expect(metrics).toHaveLength(1)
    expect(metrics[0].value).toBe(14.2)
  })

  test('an edited then unconfirmed candidate is not persisted', () => {
    let candidates = candidatesFromExtraction(extraction)
    const id = candidates[0].localId
    candidates = editMetricCandidate(candidates, id, {
      name: 'Vitamin D',
      value: 25,
      unit: 'ng/mL',
      referenceLow: 30,
      referenceHigh: 100,
    })
    // Never confirmed → excluded.
    expect(toConfirmedReportMetrics(candidates)).toEqual([])
  })
})

describe('saved report correction', () => {
  const savedMetric = {
    id: 'stable-vitamin-d-id',
    name: 'Vitamin D',
    value: 18,
    unit: 'ng/mL',
    referenceLow: 30,
    referenceHigh: 100,
    status: 'low' as const,
    confidence: 0.55,
    uncertaintyReason: 'The result was faint.',
    confirmed: true,
  }

  test('rehydrates confidence and confirmation, retaining unconfirmed rows', () => {
    const candidates = candidatesFromReportMetrics([
      savedMetric,
      {
        ...savedMetric,
        id: 'uncertain',
        name: 'Uncertain field',
        confirmed: false,
      },
    ])

    expect(candidates[0]).toMatchObject({
      persistedId: 'stable-vitamin-d-id',
      confidence: 0.55,
      confirmed: true,
    })
    expect(toReviewedReportMetrics(candidates).map((metric) => metric.id)).toEqual([
      'stable-vitamin-d-id',
      'uncertain',
    ])
    expect(toConfirmedReportMetrics(candidates).map((metric) => metric.id)).toEqual([
      'stable-vitamin-d-id',
    ])
  })

  test('editing a saved confirmed result requires explicit re-confirmation', () => {
    const [candidate] = candidatesFromReportMetrics([savedMetric])
    const [edited] = editMetricCandidate([candidate], candidate.localId, {
      name: 'Vitamin D corrected',
      value: 25,
      unit: 'ng/mL',
      referenceLow: 30,
      referenceHigh: 100,
    })

    expect(edited.confirmed).toBe(false)
    const [reconfirmed] = toggleMetricCandidate([edited], edited.localId)
    const [persisted] = toReviewedReportMetrics([reconfirmed])
    expect(persisted).toMatchObject({
      id: 'stable-vitamin-d-id',
      name: 'Vitamin D corrected',
      value: 25,
      confirmed: true,
      status: 'low',
    })
  })

  test('manual ids stay unique after deleting and adding rows', () => {
    let candidates = addManualMetricCandidate([], {
      name: 'A',
      value: 1,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
    })
    candidates = addManualMetricCandidate(candidates, {
      name: 'B',
      value: 2,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
    })
    candidates = removeMetricCandidate(candidates, 'manual-1')
    candidates = addManualMetricCandidate(candidates, {
      name: 'C',
      value: 3,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
    })

    expect(candidates.map((candidate) => candidate.localId)).toEqual([
      'manual-2',
      'manual-1',
    ])
  })
})

describe('manual entry and removal', () => {
  test('manual metrics start unconfirmed', () => {
    const candidates = addManualMetricCandidate([], {
      name: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      referenceLow: 13.5,
      referenceHigh: 17.5,
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].confirmed).toBe(false)
    expect(toConfirmedReportMetrics(candidates)).toEqual([])
  })

  test('blank required values remain invalid instead of becoming zero', () => {
    expect(Number.isNaN(parseRequiredMetricNumber(''))).toBe(true)
    expect(Number.isNaN(parseRequiredMetricNumber('   '))).toBe(true)
    expect(Number.isNaN(parseRequiredMetricNumber('not-a-number'))).toBe(true)
    expect(parseRequiredMetricNumber('0')).toBe(0)
  })

  test('a confirmed candidate with an invalid value blocks saving', () => {
    const [candidate] = candidatesFromExtraction(extraction)
    expect(
      hasInvalidConfirmedCandidates([
        { ...candidate, confirmed: true, value: Number.NaN },
      ])
    ).toBe(true)
    expect(
      hasInvalidConfirmedCandidates([{ ...candidate, confirmed: true }])
    ).toBe(false)
  })

  test('addManualMetricCandidate rejects blank names and non-finite values', () => {
    expect(
      addManualMetricCandidate([], {
        name: '   ',
        value: 1,
        unit: '',
        referenceLow: null,
        referenceHigh: null,
      })
    ).toEqual([])
    expect(
      addManualMetricCandidate([], {
        name: 'X',
        value: Number.NaN,
        unit: '',
        referenceLow: null,
        referenceHigh: null,
      })
    ).toEqual([])
  })

  test('blank manual drafts and invalid or inverted bounds block persistence', () => {
    const [draft] = addBlankManualMetricCandidate([])
    expect(draft.name).toBe('')
    expect(Number.isNaN(draft.value)).toBe(true)
    expect(hasInvalidReportCandidates([draft])).toBe(true)

    const [candidate] = candidatesFromExtraction(extraction)
    expect(
      hasInvalidReportCandidates([
        { ...candidate, referenceLow: Number.NaN },
      ])
    ).toBe(true)
    expect(
      hasInvalidReportCandidates([
        { ...candidate, referenceLow: 100, referenceHigh: 30 },
      ])
    ).toBe(true)
  })

  test('duplicate metric names are detected before conversion can drop a row', () => {
    const [candidate] = candidatesFromExtraction(extraction)
    expect(
      hasDuplicateReportCandidates([
        candidate,
        { ...candidate, localId: 'duplicate', name: `  ${candidate.name.toUpperCase()} ` },
      ])
    ).toBe(true)
  })

  test('removeMetricCandidate drops the targeted candidate', () => {
    const candidates = candidatesFromExtraction(extraction)
    const remaining = removeMetricCandidate(candidates, candidates[0].localId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('Ferritin')
  })
})
