import { fireEvent, render } from '@testing-library/react-native'

import { DashboardLoadError } from './dashboard-load-error'

describe('DashboardLoadError', () => {
  test('offers an explicit retry for a failed dashboard load', async () => {
    const onRetry = jest.fn()
    const screen = await render(
      <DashboardLoadError message="Could not load today’s data." onRetry={onRetry} />
    )

    screen.getByText('Could not load today’s data.')
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
