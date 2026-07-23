import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getSupabaseClient } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}))

vi.mock('../supabase', () => ({ getSupabaseClient }))

import { createSupabaseRepos } from './supabase'
import { fixtureEnergyResult } from '@akeso/domain'

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

describe('Supabase personalized energy repository', () => {
  beforeEach(() => {
    getSupabaseClient.mockReset()
  })

  test('persists every replay and explanation field with the owner id', async () => {
    const query = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const from = vi.fn(() => query)
    getSupabaseClient.mockReturnValue({ from })

    await createSupabaseRepos().energy.upsert(
      '11111111-1111-1111-1111-111111111111',
      fixtureEnergyResult
    )

    expect(from).toHaveBeenCalledWith('energy_result')
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: '11111111-1111-1111-1111-111111111111',
        algorithm_version: 'energy-v2-multisignal',
        confidence: 0.76,
        personal_baseline: fixtureEnergyResult.personalBaseline,
        baseline_delta: 23,
        baseline_explanation: fixtureEnergyResult.baselineExplanation,
      }),
      { onConflict: 'user_id,date' }
    )
  })

  test('bounds and owner-scopes historical check-in reads', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.lt.mockReturnValue(query)
    query.order.mockReturnValue(query)
    getSupabaseClient.mockReturnValue({ from: vi.fn(() => query) })

    await createSupabaseRepos().checkins.listBefore(
      '11111111-1111-1111-1111-111111111111',
      '2026-07-21',
      28
    )

    expect(query.eq).toHaveBeenCalledWith(
      'user_id',
      '11111111-1111-1111-1111-111111111111'
    )
    expect(query.lt).toHaveBeenCalledWith('date', '2026-07-21')
    expect(query.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(28)
  })

  test('persists follow-up calibration in its owner-scoped table', async () => {
    const query = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const from = vi.fn(() => query)
    getSupabaseClient.mockReturnValue({ from })

    await createSupabaseRepos().energyCalibrations.upsert(
      '11111111-1111-1111-1111-111111111111',
      {
        date: '2026-07-21',
        actualEnergy: 4,
        recordedAt: '2026-07-21T23:59:59.000Z',
      }
    )

    expect(from).toHaveBeenCalledWith('energy_calibration')
    expect(query.upsert).toHaveBeenCalledWith(
      {
        user_id: '11111111-1111-1111-1111-111111111111',
        date: '2026-07-21',
        actual_energy: 4,
        recorded_at: '2026-07-21T23:59:59.000Z',
      },
      { onConflict: 'user_id,date' }
    )
  })
})
