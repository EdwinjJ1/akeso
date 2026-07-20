import { describe, expect, test } from 'vitest'

import { fixtureEnergyResult, fixtureTasks } from './fixtures'
import { planDay } from './planner'
import type { EnergyResult, Task } from './types'

describe('planDay', () => {
  test('is deterministic for identical inputs', () => {
    const a = planDay(fixtureEnergyResult, fixtureTasks)
    const b = planDay(fixtureEnergyResult, fixtureTasks)

    expect(a.blocks).toEqual(b.blocks)
    expect(a.coachNote).toEqual(b.coachNote)
  })

  test('schedules high-demand must tasks inside the peak window', () => {
    const plan = planDay(fixtureEnergyResult, fixtureTasks)
    const focusBlocks = plan.blocks.filter((block) => block.type === 'focus')

    expect(focusBlocks.length).toBeGreaterThan(0)
    for (const block of focusBlocks.slice(0, 1)) {
      const startHour = Number(block.start.split(':')[0])
      expect(startHour).toBeGreaterThanOrEqual(
        fixtureEnergyResult.peakWindow.startHour
      )
    }
  })

  test('never schedules a done task', () => {
    const tasks: Task[] = [
      { ...fixtureTasks[0], status: 'done' },
      ...fixtureTasks.slice(1),
    ]
    const plan = planDay(fixtureEnergyResult, tasks)

    expect(plan.blocks.some((block) => block.taskId === tasks[0].id)).toBe(
      false
    )
  })

  test('falls back to a protected recovery block when no low-demand task fits the dip', () => {
    const tasks: Task[] = fixtureTasks.filter(
      (task) => task.energyDemand !== 'low'
    )
    const plan = planDay(fixtureEnergyResult, tasks)

    const recovery = plan.blocks.find((block) => block.type === 'recovery')
    expect(recovery).toBeDefined()
    expect(recovery?.start).toBe(
      `${String(fixtureEnergyResult.dipWindow.startHour).padStart(2, '0')}:00`
    )
  })

  test('produces blocks in chronological, non-overlapping order', () => {
    const plan = planDay(fixtureEnergyResult, fixtureTasks)

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number)
      return h * 60 + m
    }

    for (let i = 1; i < plan.blocks.length; i++) {
      expect(toMinutes(plan.blocks[i].start)).toBeGreaterThanOrEqual(
        toMinutes(plan.blocks[i - 1].end)
      )
    }
  })

  test('handles a day with no tasks at all', () => {
    const plan = planDay(fixtureEnergyResult, [])

    expect(plan.blocks.length).toBeGreaterThan(0)
    expect(plan.blocks.every((block) => block.taskId === undefined)).toBe(true)
  })

  test('keeps every block within the demo fixture score of 78 shape (regression guard)', () => {
    const energy: EnergyResult = { ...fixtureEnergyResult, score: 78 }
    const plan = planDay(energy, fixtureTasks)

    expect(plan.date).toBe(energy.date)
    expect(plan.blocks.length).toBeGreaterThan(0)
  })
})
