import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getSupabaseClient } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}))

vi.mock('../supabase', () => ({ getSupabaseClient }))

import { createSupabaseRepos } from './supabase'

describe('Supabase plan repository', () => {
  beforeEach(() => {
    getSupabaseClient.mockReset()
  })

  test('restores persisted user-edit metadata when reading a plan', async () => {
    const dayPlanQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          coach_note: 'Protect the peak window.',
          generated_at: '2026-07-21T10:00:00.000Z',
        },
        error: null,
      }),
    }
    dayPlanQuery.select.mockReturnValue(dayPlanQuery)
    dayPlanQuery.eq.mockReturnValue(dayPlanQuery)

    const blockQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'block-1',
            start_time: '09:30',
            end_time: '10:30',
            type: 'focus',
            title: 'My protected focus block',
            task_id: null,
            status: 'completed',
            source: 'user',
            original_title: 'Original focus block',
            original_start_time: '09:00',
            original_end_time: '10:00',
            energy_level: 'high',
            rationale: 'Matches the energy peak.',
          },
        ],
        error: null,
      }),
    }
    blockQuery.select.mockReturnValue(blockQuery)
    blockQuery.eq.mockReturnValue(blockQuery)

    const from = vi.fn((table: string) => {
      if (table === 'day_plan') return dayPlanQuery
      if (table === 'plan_block') return blockQuery
      throw new Error(`Unexpected table: ${table}`)
    })
    getSupabaseClient.mockReturnValue({ from })

    const plan = await createSupabaseRepos().plans.get(
      '11111111-1111-1111-1111-111111111111',
      '2026-07-21'
    )

    expect(plan?.blocks[0]).toMatchObject({
      id: 'block-1',
      title: 'My protected focus block',
      status: 'completed',
      source: 'user',
      originalSuggestion: {
        title: 'Original focus block',
        start: '09:00',
        end: '10:00',
      },
    })
  })

  test('updates only the selected block and its editable metadata', async () => {
    const blockQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'block-1' },
        error: null,
      }),
    }
    blockQuery.update.mockReturnValue(blockQuery)
    blockQuery.eq.mockReturnValue(blockQuery)
    blockQuery.select.mockReturnValue(blockQuery)
    const from = vi.fn(() => blockQuery)
    getSupabaseClient.mockReturnValue({ from })

    await createSupabaseRepos().plans.updateBlock(
      '11111111-1111-1111-1111-111111111111',
      '2026-07-21',
      {
        id: 'block-1',
        start: '09:30',
        end: '10:30',
        type: 'focus',
        title: 'My protected focus block',
        status: 'completed',
        source: 'user',
        originalSuggestion: {
          title: 'Original focus block',
          start: '09:00',
          end: '10:00',
        },
        energyLevel: 'high',
        rationale: 'Matches the energy peak.',
      }
    )

    expect(from).toHaveBeenCalledWith('plan_block')
    expect(blockQuery.update).toHaveBeenCalledWith({
      start_time: '09:30',
      end_time: '10:30',
      title: 'My protected focus block',
      status: 'completed',
      source: 'user',
      original_title: 'Original focus block',
      original_start_time: '09:00',
      original_end_time: '10:00',
    })
    expect(blockQuery.eq.mock.calls).toEqual([
      ['user_id', '11111111-1111-1111-1111-111111111111'],
      ['date', '2026-07-21'],
      ['id', 'block-1'],
    ])
  })
})
