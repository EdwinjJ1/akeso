import { fixtureCheckIn, fixtureProfile } from '@akeso/domain'
import { describe, expect, test } from 'vitest'

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
