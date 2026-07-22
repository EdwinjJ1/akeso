import { fireEvent, render, screen } from '@testing-library/react-native'
import { describe, expect, jest, test } from '@jest/globals'

import { TimeGridPicker } from './time-grid-picker'

describe('TimeGridPicker', () => {
  test('selects an hour and minute before confirming an HH:mm value', async () => {
    const onConfirm = jest.fn()
    await render(
      <TimeGridPicker
        label="Start"
        value="08:55"
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByText('08:55')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Hour 08', selected: true })
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Minute 55', selected: true })
    ).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Hour 09' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Minute 10' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Use 09:10' }))

    expect(onConfirm).toHaveBeenCalledWith('09:10')
  })

  test('cancels without confirming a changed time', async () => {
    const onCancel = jest.fn()
    const onConfirm = jest.fn()
    await render(
      <TimeGridPicker
        label="End"
        value="10:00"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Hour 11' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
