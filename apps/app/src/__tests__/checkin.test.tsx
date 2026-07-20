import type { CheckInInput } from '@akeso/domain'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import CheckIn from '../app/checkin'

const mockLoadLatestCheckIn = jest.fn<Promise<CheckInInput | null>, [string]>()
const mockSubmitCheckIn = jest.fn()

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}))
jest.mock('@/utils/dates', () => ({ todayISO: () => '2026-07-21' }))
jest.mock('@/state/app-state', () => ({
  useAppState: () => ({ loadLatestCheckIn: mockLoadLatestCheckIn, submitCheckIn: mockSubmitCheckIn }),
}))

const previous: CheckInInput = {
  date: '2026-07-20',
  sleepHours: 8,
  sleepQuality: 4,
  mood: 3,
  stress: 2,
  energyNow: 4,
  caffeine: 'morning',
  notes: 'deadline tomorrow',
}

beforeEach(() => jest.clearAllMocks())
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => jest.restoreAllMocks())

const renderCheckIn = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <CheckIn />
    </SafeAreaProvider>
  )

test('prefills the latest answers and enters update mode', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('6 / 6'))
  expect(screen.getByRole('button', { name: '8h' }).props.accessibilityState).toEqual({
    selected: true,
  })
  expect(
    screen
      .getAllByRole('button', { name: 'Low' })
      .filter((option) => option.props.accessibilityState?.selected)
  ).toHaveLength(1)
  expect(screen.getByDisplayValue('deadline tomorrow')).toBeTruthy()
  screen.getByText('Update my energy score')
})

test('submits changed answers for today and recalculates', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockResolvedValue({ score: 60 })
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  fireEvent.press(screen.getByRole('button', { name: 'Very high' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Very high' }).props.accessibilityState).toEqual({
      selected: true,
    })
  )
  fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() =>
    expect(mockSubmitCheckIn).toHaveBeenCalledWith({
      ...previous,
      date: '2026-07-21',
      stress: 5,
    })
  )
  const { router } = jest.requireMock('expo-router') as {
    router: { back: jest.Mock }
  }
  expect(router.back).toHaveBeenCalled()
})

test('keeps edited answers when saving fails', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockRejectedValue(new Error('offline'))
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  fireEvent.press(screen.getByRole('button', { name: 'Very high' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Very high' }).props.accessibilityState).toEqual({
      selected: true,
    })
  )
  fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() => screen.getByText('Something went wrong — please try again.'))
  expect(screen.getByRole('button', { name: 'Very high' }).props.accessibilityState).toEqual({
    selected: true,
  })
})

test('shows a retry action when latest answers cannot load', async () => {
  mockLoadLatestCheckIn.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(previous)
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Could not load your latest status.'))
  fireEvent.press(screen.getByText('Try again'))
  await waitFor(() => screen.getByText('Update my energy score'))
  expect(mockLoadLatestCheckIn).toHaveBeenCalledTimes(2)
})
