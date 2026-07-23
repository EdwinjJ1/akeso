import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import ReportDetailRoute from './[id]'

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn()
const mockDismissTo = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'owned-report' }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
    dismissTo: mockDismissTo,
  }),
}))

jest.mock('@/components/report/report-detail', () => ({
  ReportDetail: ({
    reportId,
    onBack,
    onDeleted,
  }: {
    reportId: string
    onBack: () => void
    onDeleted: () => void
  }) => {
    // Jest mock factories are hoisted, so these modules must be loaded inside
    // the factory instead of being captured from the test module scope.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text, View } = require('react-native') as typeof import('react-native')
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, reportId),
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'Mock back', onPress: onBack },
        React.createElement(Text, null, 'Back')
      ),
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Mock delete complete',
          onPress: onDeleted,
        },
        React.createElement(Text, null, 'Deleted')
      )
    )
  },
}))

describe('ReportDetailRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanGoBack.mockReturnValue(true)
  })

  test('passes the dynamic report id and dismisses deletion to report history', async () => {
    await render(<ReportDetailRoute />)

    expect(screen.getByText('owned-report')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mock delete complete' })
    )
    expect(mockDismissTo).toHaveBeenCalledWith('/reports')
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test('replaces with report history when a deep link has no back stack', async () => {
    mockCanGoBack.mockReturnValue(false)
    await render(<ReportDetailRoute />)

    await fireEvent.press(screen.getByRole('button', { name: 'Mock back' }))
    expect(mockReplace).toHaveBeenCalledWith('/reports')
    expect(mockBack).not.toHaveBeenCalled()
  })
})
