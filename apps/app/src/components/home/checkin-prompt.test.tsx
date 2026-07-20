import { render } from '@testing-library/react-native'

import { CheckInPrompt } from './checkin-prompt'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('CheckInPrompt', () => {
  test('invites a new user to start the first check-in', async () => {
    const screen = await render(<CheckInPrompt mode="first" />)

    screen.getByText('Start check-in')
    screen.getByText('How’s your energy, really?')
  })

  test('reminds a returning user to update today without showing a stale score', async () => {
    const screen = await render(<CheckInPrompt mode="daily" />)

    expect(screen.getAllByText('Update today’s status')).toHaveLength(2)
    screen.getByText('Your last answers are ready — only change what feels different today.')
    expect(screen.queryByText(/\/ 100/)).toBeNull()
  })
})
