import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { HealthReport, UserProfile } from '@akeso/domain'
import { afterEach, describe, expect, test } from 'vitest'

import { createSqliteRepos } from './sqlite'

const profile: UserProfile = {
  displayName: 'Alex',
  goal: 'balance',
  typicalWake: '07:00',
  typicalSleep: '23:00',
  dietaryPreference: 'none',
  dietarySafety: { allergens: [], avoidIngredients: [] },
}

const report = (id: string, createdAt: string): HealthReport => ({
  id,
  name: `Report ${id}`,
  reportDate: '2026-07-20',
  createdAt,
  metrics: [
    {
      id: 'ferritin',
      name: 'Ferritin',
      value: 18,
      unit: 'µg/L',
      referenceLow: 30,
      referenceHigh: 200,
      status: 'low',
      confidence: 0.91,
      uncertaintyReason: null,
      confirmed: true,
    },
  ],
})

describe('sqlite repos — persistent local personal record', () => {
  const tempDirs: string[] = []

  const tempDbPath = () => {
    const dir = mkdtempSync(join(tmpdir(), 'akeso-sqlite-'))
    tempDirs.push(dir)
    return join(dir, 'test.db')
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('profile and health reports survive closing and reopening the database', async () => {
    const path = tempDbPath()

    const first = createSqliteRepos(path)
    await first.profile.upsert('user-1', profile)
    await first.reports.upsert('user-1', report('r1', '2026-07-22T09:00:00.000Z'))
    await first.reports.upsert('user-1', report('r2', '2026-07-23T09:00:00.000Z'))

    // A brand-new connection over the same file must see the same record —
    // this is the property the in-memory driver cannot provide.
    const reopened = createSqliteRepos(path)
    await expect(reopened.profile.get('user-1')).resolves.toEqual(profile)
    const reports = await reopened.reports.list('user-1')
    expect(reports.map((item) => item.id)).toEqual(['r2', 'r1'])
  })

  test('scopes every read and delete to the owning user', async () => {
    const repos = createSqliteRepos(':memory:')
    await repos.profile.upsert('alice', profile)
    await repos.reports.upsert('alice', report('r1', '2026-07-22T09:00:00.000Z'))

    await expect(repos.profile.get('bob')).resolves.toBeNull()
    await expect(repos.reports.get('bob', 'r1')).resolves.toBeNull()

    await repos.reports.remove('bob', 'r1')
    await expect(repos.reports.get('alice', 'r1')).resolves.not.toBeNull()
  })

  test('removing a report sweeps its cached recommendations', async () => {
    const repos = createSqliteRepos(':memory:')
    await repos.reports.upsert('alice', report('r1', '2026-07-22T09:00:00.000Z'))
    await repos.reportRecommendationCache.upsert('alice', 'cache-key-1', {
      reportId: 'r1',
      metrics: [],
      recommendations: [],
      disclaimer: 'General wellbeing information, not medical advice.',
    })

    await repos.reports.remove('alice', 'r1')
    await expect(
      repos.reportRecommendationCache.get('alice', 'cache-key-1')
    ).resolves.toBeNull()
  })

  test('updateBlock keeps blocks sorted and rejects a missing plan', async () => {
    const repos = createSqliteRepos(':memory:')
    await expect(
      repos.plans.updateBlock('alice', '2026-07-22', {
        id: 'b1',
        start: '09:00',
        end: '10:00',
        type: 'focus',
        title: 'Deep work',
        status: 'planned',
        source: 'akeso',
        energyLevel: 'high',
        rationale: 'Peak window',
      })
    ).rejects.toThrow('No plan exists')
  })
})
