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
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  lastMealDescription: 'leftover salmon rice bowl',
  hydration: '1_1_5l',
}

beforeEach(() => {
  jest.clearAllMocks()
  const { router } = jest.requireMock('expo-router') as {
    router: { canGoBack: jest.Mock }
  }
  router.canGoBack.mockReturnValue(true)
})
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

  await waitFor(() => screen.getByText('4 / 4'))
  expect(screen.getByRole('button', { name: '7–8h' }).props.accessibilityState).toEqual({
    selected: true,
  })
  expect(screen.getByRole('button', { name: 'Good' }).props.accessibilityState).toEqual({
    selected: true,
  })
  expect(screen.getByDisplayValue('leftover salmon rice bowl')).toBeTruthy()
  screen.getByText('Update my energy score')
})

test('submits changed answers for today and recalculates', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockResolvedValue({ score: 60 })
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  await fireEvent.press(screen.getByRole('button', { name: 'Charged' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Charged' }).props.accessibilityState).toEqual({
      selected: true,
    })
  )
  await fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() =>
    expect(mockSubmitCheckIn).toHaveBeenCalledWith({
      ...previous,
      date: '2026-07-21',
      reportedEnergy: 5,
    })
  )
  const { router } = jest.requireMock('expo-router') as {
    router: { back: jest.Mock }
  }
  expect(router.back).toHaveBeenCalled()
})

test('returns to the dashboard after a direct-route submission', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockResolvedValue({ score: 60 })
  const { router } = jest.requireMock('expo-router') as {
    router: { back: jest.Mock; canGoBack: jest.Mock; replace: jest.Mock }
  }
  router.canGoBack.mockReturnValue(false)
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  await fireEvent.press(screen.getByText('Update my energy score'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
  expect(router.back).not.toHaveBeenCalled()
})

test('confirms unchanged inherited answers for today', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockResolvedValue({ score: 60 })
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  await fireEvent.press(screen.getByText('Update my energy score'))

  await waitFor(() =>
    expect(mockSubmitCheckIn).toHaveBeenCalledWith({
      ...previous,
      date: '2026-07-21',
    })
  )
})

test('clears the inherited meal note when the user removes it', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockResolvedValue({ score: 60 })
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  await fireEvent.changeText(screen.getByDisplayValue('leftover salmon rice bowl'), '')
  await fireEvent.press(screen.getByText('Update my energy score'))

  await waitFor(() =>
    expect(mockSubmitCheckIn).toHaveBeenCalledWith({
      ...previous,
      date: '2026-07-21',
      lastMealDescription: undefined,
    })
  )
})

test('keeps edited answers when saving fails', async () => {
  mockLoadLatestCheckIn.mockResolvedValue(previous)
  mockSubmitCheckIn.mockRejectedValue(new Error('offline'))
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Update my energy score'))
  await fireEvent.press(screen.getByRole('button', { name: 'Charged' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Charged' }).props.accessibilityState).toEqual({
      selected: true,
    })
  )
  await fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() => screen.getByText('Something went wrong — please try again.'))
  expect(screen.getByRole('button', { name: 'Charged' }).props.accessibilityState).toEqual({
    selected: true,
  })
})

test('shows a retry action when latest answers cannot load', async () => {
  mockLoadLatestCheckIn.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(previous)
  const screen = await renderCheckIn()

  await waitFor(() => screen.getByText('Could not load your latest status.'))
  await fireEvent.press(screen.getByText('Try again'))
  await waitFor(() => screen.getByText('Update my energy score'))
  expect(mockLoadLatestCheckIn).toHaveBeenCalledTimes(2)
})
