import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  fixtureProfile,
  type HealthRecommendationSet,
} from '@akeso/domain'

import { useAppState } from '@/state/app-state'

import {
  demoRecommendations,
  demoSavedReport,
} from './report-demo'
import { ReportManager } from './report-manager'

jest.mock('@/state/app-state', () => ({ useAppState: jest.fn() }))
const mockRouterPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    // The hoisted mock factory cannot capture the module-level React binding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react')
    React.useEffect(callback, [callback])
  },
}))
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

const mockedUseAppState = jest.mocked(useAppState)

describe('ReportManager', () => {
  const mockAppState = (overrides: Record<string, unknown> = {}) => {
    mockedUseAppState.mockReturnValue({
      profile: fixtureProfile,
      extractReportMetrics: jest.fn(),
      getReports: jest.fn().mockResolvedValue([demoSavedReport]),
      saveReport: jest.fn(),
      deleteReport: jest.fn(),
      getReportRecommendations: jest.fn().mockResolvedValue(demoRecommendations),
      regenerateReportRecommendations: jest
        .fn()
        .mockResolvedValue(demoRecommendations),
      ...overrides,
    } as unknown as ReturnType<typeof useAppState>)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockAppState()
  })

  test('shows every upload source and a compact report-history entry', async () => {
    await render(<ReportManager />)

    expect(screen.getByRole('button', { name: 'Camera, Take a photo' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Photos, JPG or PNG' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Files, PDF preview' })).toBeOnTheScreen()

    expect(await screen.findByText('General pathology report')).toBeOnTheScreen()
    expect(screen.getByText('2 confirmed')).toBeOnTheScreen()
    expect(screen.getByText('1 unconfirmed')).toBeOnTheScreen()
    expect(screen.getByText('1 low confidence')).toBeOnTheScreen()
  })

  test('opens a saved report on its independent detail route', async () => {
    await render(<ReportManager />)

    await screen.findByText('General pathology report')
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'View details for General pathology report',
      })
    )

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/report/[id]',
      params: { id: demoSavedReport.id },
    })
  })
})
