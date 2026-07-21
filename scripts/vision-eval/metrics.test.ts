import { describe, expect, it } from 'vitest'
import { aggregateVisionMetrics, scoreRecognition } from './metrics'

describe('vision evaluation metrics', () => {
  it('counts additions, deletions and category edits from presence-only output', () => {
    const score = scoreRecognition(
      [
        { name: 'tomato', category: 'vegetable', aliases: ['tomatoes'] },
        { name: 'milk', category: 'dairy' },
      ],
      [
        {
          name: 'Tomatoes',
          category: 'fruit',
          confidence: 0.91,
          uncertaintyReason: null,
        },
        {
          name: 'bread',
          category: 'grain',
          confidence: 0.82,
          uncertaintyReason: null,
        },
      ]
    )

    expect(score).toEqual({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 1,
      categoryMatches: 0,
      matchedIngredients: 1,
      humanAdditions: 1,
      humanEdits: 1,
      humanDeletions: 1,
    })
  })

  it('aggregates quality, hallucination, schema, latency and cost metrics', () => {
    const metrics = aggregateVisionMetrics([
      {
        schemaValid: true,
        latencyMs: 100,
        costUsd: 0.01,
        score: {
          truePositives: 3,
          falsePositives: 1,
          falseNegatives: 1,
          categoryMatches: 2,
          matchedIngredients: 3,
          humanAdditions: 1,
          humanEdits: 1,
          humanDeletions: 1,
        },
      },
      {
        schemaValid: false,
        latencyMs: 300,
        costUsd: 0.02,
      },
    ])

    expect(metrics).toMatchObject({
      schemaSuccessRate: 0.5,
      precision: 0.75,
      recall: 0.75,
      f1: 0.75,
      categoryAccuracy: 2 / 3,
      hallucinationRate: 0.25,
      humanAdditions: 1,
      humanEdits: 1,
      humanDeletions: 1,
      p50LatencyMs: 100,
      p95LatencyMs: 300,
      totalCostUsd: 0.03,
      costPerImageUsd: 0.015,
    })
  })

  it('does not award perfect quality scores when no response is scorable', () => {
    const metrics = aggregateVisionMetrics([
      { schemaValid: false, latencyMs: 250, costUsd: 0 },
    ])

    expect(metrics).toMatchObject({
      schemaSuccessRate: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      categoryAccuracy: 0,
      hallucinationRate: 0,
    })
  })
})
