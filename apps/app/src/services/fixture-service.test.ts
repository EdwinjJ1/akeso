/// <reference types="jest" />

import type { CheckInInput } from '@akeso/domain'

import { FixtureService } from './fixture-service'

jest.mock(
  '@react-native-async-storage/async-storage',
  () => {
    const values = new Map<string, string>()

    return {
      __esModule: true,
      default: {
        clear: jest.fn(async () => values.clear()),
        getItem: jest.fn(async (key: string) => values.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
          values.set(key, value)
        }),
      },
    }
  }
)

const checkIn = (date: string, stress: CheckInInput['stress']): CheckInInput => ({
  date,
  sleepHours: 8,
  sleepQuality: 4,
  mood: 4,
  stress,
  energyNow: 4,
  caffeine: 'morning',
  notes: 'steady',
})

describe('FixtureService latest check-in', () => {
  beforeEach(async () => {
    const storage = jest.requireMock('@react-native-async-storage/async-storage')
      .default as { clear: () => Promise<void> }
    await storage.clear()
  })

  test('returns null before the first check-in', async () => {
    const service = new FixtureService()
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toBeNull()
  })

  test('inherits the latest check-in at or before the requested day', async () => {
    const service = new FixtureService()
    await service.submitCheckIn(checkIn('2026-07-20', 2))
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toEqual(
      checkIn('2026-07-20', 2)
    )
  })

  test('retains answers after the service is recreated', async () => {
    const service = new FixtureService()
    await service.submitCheckIn(checkIn('2026-07-20', 2))

    const restartedService = new FixtureService()
    await expect(restartedService.getLatestCheckIn('2026-07-21')).resolves.toEqual(
      checkIn('2026-07-20', 2)
    )
  })

  test('same-day submission replaces answers and recalculates the score', async () => {
    const service = new FixtureService()
    const first = await service.submitCheckIn(checkIn('2026-07-21', 2))
    const updated = await service.submitCheckIn(checkIn('2026-07-21', 5))
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toEqual(
      checkIn('2026-07-21', 5)
    )
    expect(updated.score).toBeLessThan(first.score)
    await expect(service.getTodayEnergy('2026-07-21')).resolves.toEqual(updated)
  })
})
