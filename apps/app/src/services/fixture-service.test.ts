import { fixtureCheckIn, fixtureProfile } from '@akeso/domain'
import { describe, expect, test } from 'vitest'

import {
  getReportFixtureScenario,
  reportFixtureScenarios,
} from '../components/report/report-demo'
import { FixtureService } from './fixture-service'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('FixtureService local profile persistence', () => {
  test('restores onboarding data in a new service instance', async () => {
    const storage = memoryStorage()
    await new FixtureService(0, storage).saveProfile(fixtureProfile)

    await expect(new FixtureService(0, storage).getProfile()).resolves.toEqual(
      fixtureProfile
    )
  })

  test('ignores malformed or schema-invalid stored data', async () => {
    const storage = memoryStorage()
    await storage.setItem(
      'akeso.demo.profile.v1',
      JSON.stringify({ displayName: 'Incomplete' })
    )

    await expect(new FixtureService(0, storage).getProfile()).resolves.toBeNull()
  })
})

describe('FixtureService editable plan flow', () => {
  test('persists an updated block and leaves energy unchanged', async () => {
    const service = new FixtureService(0)
    await service.submitCheckIn(fixtureCheckIn)
    const energyBefore = await service.getTodayEnergy(fixtureCheckIn.date)
    const plan = await service.getTodayPlan(fixtureCheckIn.date)
    if (!plan) throw new Error('Expected a fixture plan')
    const original = plan.blocks[0]

    const updated = await service.updatePlanBlock(
      fixtureCheckIn.date,
      original.id,
      {
        title: 'My updated block',
        start: original.start,
        end: original.end,
        status: 'completed',
      }
    )

    expect(updated.blocks[0]).toMatchObject({
      title: 'My updated block',
      status: 'completed',
      source: 'user',
    })
    expect(await service.getTodayPlan(fixtureCheckIn.date)).toEqual(updated)
    expect(await service.getTodayEnergy(fixtureCheckIn.date)).toEqual(energyBefore)
  })

  test('preserves the updated block when regenerating', async () => {
    const service = new FixtureService(0)
    await service.submitCheckIn(fixtureCheckIn)
    const plan = await service.getTodayPlan(fixtureCheckIn.date)
    if (!plan) throw new Error('Expected a fixture plan')
    const original = plan.blocks[0]
    await service.updatePlanBlock(fixtureCheckIn.date, original.id, {
      title: 'Keep this edit',
      start: original.start,
      end: original.end,
      status: 'planned',
    })

    const { plan: regenerated } = await service.regeneratePlan(
      fixtureCheckIn.date
    )
    expect(
      regenerated.blocks.find((block) => block.id === original.id)
    ).toMatchObject({ title: 'Keep this edit', source: 'user' })
  })
})

describe('FixtureService health-report demo flow', () => {
  test('serves every deterministic report scenario without an AI key', async () => {
    const service = new FixtureService(0)

    for (const scenario of reportFixtureScenarios) {
      const upload = {
        uri: `fixture-report://${scenario.id}`,
        filename: scenario.filename,
        mimeType: 'image/jpeg' as const,
      }
      if (scenario.id === 'retry') {
        await expect(service.extractReportMetrics(upload)).rejects.toThrow(
          'Fixture parsing failed safely'
        )
      }
      await expect(service.extractReportMetrics(upload)).resolves.toEqual(
        scenario.extraction
      )
    }
  })

  test('keeps prompt-injection text unconfirmed and out of advice', async () => {
    const service = new FixtureService(0)
    const scenario = getReportFixtureScenario('prompt-injection')
    const extracted = await service.extractReportMetrics({
      uri: `fixture-report://${scenario.id}`,
      filename: scenario.filename,
      mimeType: 'image/jpeg',
    })
    if (extracted.status !== 'ok') throw new Error('Expected fixture metrics')

    const report = await service.saveReport({
      name: scenario.reportName,
      reportDate: scenario.reportDate,
      metrics: extracted.metrics.map((metric, index) => ({
        ...metric,
        id: index === 0 ? 'haemoglobin' : 'injection-text',
        status: 'unknown',
        confirmed: index === 0,
      })),
    })
    const recommendations = await service.getReportRecommendations(report.id)
    const body = JSON.stringify(recommendations)

    expect(recommendations.metrics.map((metric) => metric.id)).toEqual([
      'haemoglobin',
    ])
    expect(body).not.toContain('IGNORE PREVIOUS RULES')
    expect(body).not.toContain('injection-text')
    expect(body).not.toContain('999')
  })

  test('regenerates advice from a user-corrected current value', async () => {
    const service = new FixtureService(0)
    const report = await service.saveReport({
      name: 'Correction fixture',
      reportDate: '2026-07-18',
      metrics: [
        {
          id: 'ferritin',
          name: 'Ferritin',
          value: 18,
          unit: 'µg/L',
          referenceLow: 30,
          referenceHigh: 200,
          status: 'normal',
          confidence: 0.94,
          uncertaintyReason: null,
          confirmed: true,
        },
      ],
    })
    const before = await service.getReportRecommendations(report.id)
    expect(before.metrics[0]).toMatchObject({ value: 18, status: 'low' })
    expect(before.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'follow_up' }),
      ])
    )

    await service.updateReportMetrics(report.id, {
      metrics: [{ ...report.metrics[0], value: 42, confirmed: true }],
    })
    const after = await service.regenerateReportRecommendations(report.id)

    expect(after.metrics[0]).toMatchObject({ value: 42, status: 'normal' })
    expect(after.recommendations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'follow_up' }),
      ])
    )
  })
})
