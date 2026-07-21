import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { describe, expect, jest, test } from '@jest/globals'

import { fixtureDayPlan } from '@akeso/domain'

import { PlanBlockUpdateSheet } from './plan-block-update-sheet'

const chooseTime = async (
  fieldLabel: 'Start time' | 'End time',
  value: string
) => {
  const [hour, minute] = value.split(':')
  await fireEvent.press(screen.getByLabelText(fieldLabel))
  await fireEvent.press(screen.getByRole('button', { name: `Hour ${hour}` }))
  await fireEvent.press(screen.getByRole('button', { name: `Minute ${minute}` }))
  await fireEvent.press(screen.getByRole('button', { name: `Use ${value}` }))
}

describe('PlanBlockUpdateSheet', () => {
  const block = fixtureDayPlan.blocks[0]

  test('submits title, time and completion changes', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()
    await render(
      <PlanBlockUpdateSheet
        visible
        block={block}
        blocks={fixtureDayPlan.blocks}
        onClose={onClose}
        onSave={onSave}
      />
    )

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Updated breakfast')
    await chooseTime('Start time', '08:15')
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Completed' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: 'Updated breakfast',
        start: '08:15',
        end: block.end,
        status: 'completed',
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  test('retains the draft after a save failure and retries it', async () => {
    const onSave = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    const onClose = jest.fn()
    await render(
      <PlanBlockUpdateSheet
        visible
        block={block}
        blocks={fixtureDayPlan.blocks}
        onClose={onClose}
        onSave={onSave}
      />
    )

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Keep this draft')
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByText('Couldn’t save your update. Your changes are still here.')
    ).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Keep this draft')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onClose).toHaveBeenCalled()
  })

  test('blocks a save that overlaps another suggestion', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    await render(
      <PlanBlockUpdateSheet
        visible
        block={block}
        blocks={fixtureDayPlan.blocks}
        onClose={jest.fn()}
        onSave={onSave}
      />
    )

    await chooseTime('Start time', fixtureDayPlan.blocks[1].start)
    await chooseTime('End time', fixtureDayPlan.blocks[1].end)
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/overlaps another suggestion/i)).toBeOnTheScreen()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('cancels a time selection without changing the draft', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    await render(
      <PlanBlockUpdateSheet
        visible
        block={block}
        blocks={fixtureDayPlan.blocks}
        onClose={jest.fn()}
        onSave={onSave}
      />
    )

    await fireEvent.press(screen.getByLabelText('Start time'))
    await fireEvent.press(screen.getByRole('button', { name: 'Hour 09' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: block.title,
        start: block.start,
        end: block.end,
        status: block.status,
      })
    )
  })
})
