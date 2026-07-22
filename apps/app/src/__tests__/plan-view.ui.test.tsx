import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import {
  fixtureDayPlan,
  fixtureEnergyResult,
  type DayPlan,
  type PlanBlock,
} from '@akeso/domain'

import { PlanView } from '../app/(tabs)/plan'

const callbacks = {
  onRefresh: jest.fn(),
  onRegenerate: jest.fn().mockResolvedValue(undefined),
  onUpdateBlock: jest.fn().mockResolvedValue(undefined),
}

describe('PlanView states', () => {
  beforeEach(() => jest.clearAllMocks())

  test('shows a dedicated loading state', async () => {
    await render(
      <PlanView
        energy={null}
        plan={null}
        coach={null}
        loading
        error={null}
        {...callbacks}
      />
    )

    expect(screen.getByText('Reading today’s plan…')).toBeOnTheScreen()
    expect(screen.queryByText('Your plan is waiting')).not.toBeOnTheScreen()
  })

  test('shows an empty suggestion state with regenerate', async () => {
    await render(
      <PlanView
        energy={fixtureEnergyResult}
        plan={{ ...fixtureDayPlan, blocks: [] }}
        coach={null}
        loading={false}
        error={null}
        {...callbacks}
      />
    )

    expect(screen.getByText('No suggestions yet')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Regenerate suggestions' })
    ).toBeOnTheScreen()
  })

  test('removes Tasks and opens Update from every suggestion card', async () => {
    await render(
      <PlanView
        energy={fixtureEnergyResult}
        plan={fixtureDayPlan}
        coach={null}
        loading={false}
        error={null}
        {...callbacks}
      />
    )

    expect(screen.queryByText('Tasks')).not.toBeOnTheScreen()
    const updateButtons = screen.getAllByRole('button', { name: 'Update' })
    expect(updateButtons).toHaveLength(fixtureDayPlan.blocks.length)
    await fireEvent.press(updateButtons[0])
    expect(screen.getByDisplayValue(fixtureDayPlan.blocks[0].title)).toBeOnTheScreen()
  })

  test('marks completed user blocks and reveals the original suggestion', async () => {
    const original = fixtureDayPlan.blocks[0]
    const updated: PlanBlock = {
      ...original,
      title: 'My breakfast plan',
      status: 'completed',
      source: 'user',
      originalSuggestion: {
        title: original.title,
        start: original.start,
        end: original.end,
      },
    }
    const plan: DayPlan = {
      ...fixtureDayPlan,
      blocks: [updated, ...fixtureDayPlan.blocks.slice(1)],
    }

    await render(
      <PlanView
        energy={fixtureEnergyResult}
        plan={plan}
        coach={null}
        loading={false}
        error={null}
        {...callbacks}
      />
    )

    expect(screen.getByText('Updated by you')).toBeOnTheScreen()
    expect(screen.getByText('Completed')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Show original suggestion' })
    )
    expect(screen.getByText(original.title)).toBeOnTheScreen()
    expect(screen.getByText(`${original.start}–${original.end}`)).toBeOnTheScreen()
  })
})
