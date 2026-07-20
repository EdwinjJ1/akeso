import { act, render } from '@testing-library/react-native'
import type { AppStateStatus, NativeEventSubscription } from 'react-native'
import { AppState } from 'react-native'

import { useDashboardRefresh } from './use-dashboard-refresh'

let focusCallback: (() => void | (() => void)) | undefined
let appStateListener: ((state: AppStateStatus) => void) | undefined
let mockCurrentDay = '2026-07-21'
const removeAppStateListener = jest.fn()

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        focusCallback = callback
        return callback()
      }, [callback])
    },
  }
})

jest.mock('@/utils/dates', () => ({ todayISO: () => mockCurrentDay }))

function Probe({ refresh }: { refresh: () => Promise<void> }) {
  useDashboardRefresh(refresh)
  return null
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date(2026, 6, 21, 23, 59, 59, 0))
  mockCurrentDay = '2026-07-21'
  focusCallback = undefined
  appStateListener = undefined
  removeAppStateListener.mockClear()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener
    return { remove: removeAppStateListener } as NativeEventSubscription
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

test('refreshes when the dashboard gains focus', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined)
  await render(<Probe refresh={refresh} />)

  expect(refresh).toHaveBeenCalledTimes(1)

  await act(async () => {
    focusCallback?.()
    await Promise.resolve()
  })

  expect(refresh).toHaveBeenCalledTimes(2)
})

test('refreshes when the app returns to the foreground', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined)
  await render(<Probe refresh={refresh} />)

  await act(async () => {
    appStateListener?.('background')
    appStateListener?.('active')
    await Promise.resolve()
  })

  expect(refresh).toHaveBeenCalledTimes(2)
})

test('refreshes once when the local day changes while foregrounded', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined)
  await render(<Probe refresh={refresh} />)

  mockCurrentDay = '2026-07-22'
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_001)
  })

  expect(refresh).toHaveBeenCalledTimes(2)
})

test('pauses the day-boundary timer while backgrounded and reschedules on foreground', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined)
  const screen = await render(<Probe refresh={refresh} />)

  await act(async () => {
    appStateListener?.('background')
    await Promise.resolve()
  })

  mockCurrentDay = '2026-07-22'
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_001)
  })
  expect(refresh).toHaveBeenCalledTimes(1)

  await act(async () => {
    appStateListener?.('active')
    await Promise.resolve()
  })
  expect(refresh).toHaveBeenCalledTimes(2)

  await screen.unmount()
  expect(removeAppStateListener).toHaveBeenCalledTimes(1)
})
