import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

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
    jest.clearAllMocks()
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

  test('runs the photo upload → extract → confirm → save flow', async () => {
    const extractReportMetrics = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({
        status: 'ok',
        metrics: [
          {
            name: 'Haemoglobin',
            value: 132,
            unit: 'g/L',
            referenceLow: 120,
            referenceHigh: 160,
            confidence: 0.98,
            uncertaintyReason: null,
          },
        ],
      })
    const saveReport = jest.fn<(metrics: unknown) => Promise<unknown>>().mockResolvedValue({
      id: 'saved-report',
      createdAt: '2026-07-23T00:00:00.000Z',
      metrics: [],
    })
    mockedUseAppState.mockReturnValue({
      extractReportMetrics,
      getReports: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
      saveReport,
      deleteReport: jest.fn(),
      getReportRecommendations: jest.fn(),
      regenerateReportRecommendations: jest.fn(),
    } as unknown as ReturnType<typeof useAppState>)
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'file://report.jpg', width: 1000, height: 1400, fileName: 'report.jpg', fileSize: 120000 },
        ],
      } as never)
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValue({ uri: 'file://processed.jpg', width: 1000, height: 1400 } as never)

    await render(<ReportManager />)
    await fireEvent.press(screen.getByRole('button', { name: 'Photos, JPG or PNG' }))

    expect(await screen.findByText('Review the extracted details')).toBeOnTheScreen()
    expect(extractReportMetrics).toHaveBeenCalledTimes(1)

    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Confirm Haemoglobin' })
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save confirmed metrics and continue' })
    )

    expect(await screen.findByText('Report saved')).toBeOnTheScreen()
    expect(saveReport).toHaveBeenCalledTimes(1)
    expect(saveReport.mock.calls[0][0]).toEqual([
      expect.objectContaining({ name: 'Haemoglobin', value: 132, status: 'normal' }),
    ])
  })

  test('offers retry after a failed extraction and recovers on retry', async () => {
    const extractReportMetrics = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('Extraction service unavailable.'))
      .mockResolvedValueOnce({
        status: 'ok',
        metrics: [
          {
            name: 'Ferritin',
            value: 18,
            unit: 'µg/L',
            referenceLow: 30,
            referenceHigh: 200,
            confidence: 0.94,
            uncertaintyReason: null,
          },
        ],
      })
    mockedUseAppState.mockReturnValue({
      extractReportMetrics,
      getReports: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
      saveReport: jest.fn(),
      deleteReport: jest.fn(),
      getReportRecommendations: jest.fn(),
      regenerateReportRecommendations: jest.fn(),
    } as unknown as ReturnType<typeof useAppState>)
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'file://report.jpg', width: 1000, height: 1400, fileName: 'report.jpg', fileSize: 120000 },
        ],
      } as never)
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValue({ uri: 'file://processed.jpg', width: 1000, height: 1400 } as never)

    await render(<ReportManager />)
    await fireEvent.press(screen.getByRole('button', { name: 'Photos, JPG or PNG' }))

    expect(
      await screen.findByText('Extraction service unavailable.')
    ).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Retry report extraction' })
    )

    expect(await screen.findByText('Review the extracted details')).toBeOnTheScreen()
    expect(extractReportMetrics).toHaveBeenCalledTimes(2)
  })

  test('ignores a second upload tap while the first is still in flight', async () => {
    let releasePicker: (value: unknown) => void = () => {}
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockReturnValue(
      new Promise((resolve) => {
        releasePicker = resolve
      }) as never
    )

    await render(<ReportManager />)
    const photosButton = screen.getByRole('button', { name: 'Photos, JPG or PNG' })
    const cameraButton = screen.getByRole('button', { name: 'Camera, Take a photo' })
    await act(async () => {
      fireEvent.press(photosButton)
      fireEvent.press(photosButton)
      fireEvent.press(cameraButton)
      releasePicker({ canceled: true })
    })

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1)
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled()
  })
})
