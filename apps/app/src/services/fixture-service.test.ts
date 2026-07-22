import { fixtureCheckIn } from '@akeso/domain'
import { describe, expect, test } from 'vitest'

import { FixtureService } from './fixture-service'

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
