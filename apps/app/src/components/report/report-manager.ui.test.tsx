import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { useAppState } from '@/state/app-state'

import {
  demoRecommendations,
  demoSavedReport,
} from './report-demo'
import { ReportManager } from './report-manager'

jest.mock('@/state/app-state', () => ({ useAppState: jest.fn() }))
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
  beforeEach(() => {
    mockedUseAppState.mockReturnValue({
      extractReportMetrics: jest.fn(),
      getReports: jest.fn().mockResolvedValue([demoSavedReport]),
      saveReport: jest.fn(),
      deleteReport: jest.fn(),
      getReportRecommendations: jest.fn().mockResolvedValue(demoRecommendations),
      regenerateReportRecommendations: jest
        .fn()
        .mockResolvedValue(demoRecommendations),
    } as unknown as ReturnType<typeof useAppState>)
  })

  test('shows every upload source and an explainable sample report', async () => {
    await render(<ReportManager />)

    expect(screen.getByRole('button', { name: 'Camera, Take a photo' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Photos, JPG or PNG' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Files, PDF preview' })).toBeOnTheScreen()

    expect(await screen.findByText('General pathology report')).toBeOnTheScreen()
    expect(screen.getByText('Confirmed results')).toBeOnTheScreen()
    expect(screen.getAllByText('Below report range').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BASED ON CONFIRMED').length).toBeGreaterThan(0)
    expect(screen.getByText('Not a medical diagnosis')).toBeOnTheScreen()
  })

  test('shows a destructive-action confirmation before deleting', async () => {
    await render(<ReportManager />)

    await screen.findByText('General pathology report')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Delete this health report' })
    )

    expect(screen.getByText('Delete this report?')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Confirm delete report' })
    ).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancel report deletion' })
    )
    expect(screen.queryByText('Delete this report?')).not.toBeOnTheScreen()
  })
})
