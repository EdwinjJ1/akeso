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

  test('shows every upload source and an explainable sample report', async () => {
    await render(<ReportManager />)

    expect(screen.getByRole('button', { name: 'Camera, Take a photo' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Photos, JPG or PNG' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Files, PDF preview' })).toBeOnTheScreen()

    expect(await screen.findByText('General pathology report')).toBeOnTheScreen()
    expect(screen.getByText('Confirmed results')).toBeOnTheScreen()
    expect(screen.getByText('2 need review')).toBeOnTheScreen()
    expect(screen.getAllByText('Below report range').length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        'Personalised using your saved goal and dietary preference; grounded only in confirmed metrics'
      )
    ).toBeOnTheScreen()
    expect(
      screen.getAllByText('ADVICE BASIS — CONFIRMED METRICS').length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Make room to de-stress')).toBeOnTheScreen()
    expect(screen.getAllByText('Ferritin: 18 µg/L').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vitamin D: 48 nmol/L').length).toBeGreaterThan(0)
    expect(screen.getByText('Not a medical diagnosis')).toBeOnTheScreen()
    expect(screen.getByText(demoRecommendations.disclaimer)).toBeOnTheScreen()
  })

  test('uses server-rendered recommendation metrics as the visible advice basis', async () => {
    const report = { ...demoSavedReport, id: 'server-evidence-report' }
    const serverRecommendations: HealthRecommendationSet = {
      ...demoRecommendations,
      reportId: report.id,
      metrics: [
        {
          ...demoRecommendations.metrics[0],
          name: 'Server-confirmed haemoglobin',
          value: 14.2,
          unit: 'g/dL',
        },
      ],
      recommendations: [
        {
          ...demoRecommendations.recommendations[0],
          basedOnMetricIds: ['demo-haemoglobin'],
        },
      ],
    }
    const getReportRecommendations = jest
      .fn()
      .mockResolvedValue(serverRecommendations)
    mockAppState({
      getReports: jest.fn().mockResolvedValue([report]),
      getReportRecommendations,
    })

    await render(<ReportManager />)
    await screen.findByText('Health report')
    await fireEvent.press(
      screen.getByRole('button', { name: 'View report details' })
    )
    await fireEvent.press(
      await screen.findByRole('button', { name: 'View report recommendations' })
    )

    expect(
      await screen.findByText('Server-confirmed haemoglobin: 14.2 g/dL')
    ).toBeOnTheScreen()
    expect(screen.queryByText('Haemoglobin: 132 g/L')).not.toBeOnTheScreen()
    expect(getReportRecommendations).toHaveBeenCalledWith(report.id)
  })

  test('hides recommendations that have no server-confirmed metric basis', async () => {
    const report = { ...demoSavedReport, id: 'ungrounded-report' }
    const ungroundedRecommendations: HealthRecommendationSet = {
      ...demoRecommendations,
      reportId: report.id,
      recommendations: [
        {
          id: 'ungrounded',
          category: 'general',
          title: 'Provider-controlled ungrounded advice',
          detail: 'This must never be shown.',
          basedOnMetricIds: ['phantom'],
        },
      ],
    }
    mockAppState({
      getReports: jest.fn().mockResolvedValue([report]),
      getReportRecommendations: jest
        .fn()
        .mockResolvedValue(ungroundedRecommendations),
    })

    await render(<ReportManager />)
    await screen.findByText('Health report')
    await fireEvent.press(
      screen.getByRole('button', { name: 'View report details' })
    )
    await fireEvent.press(
      await screen.findByRole('button', { name: 'View report recommendations' })
    )

    expect(
      await screen.findByText(
        'Advice is unavailable because no confirmed metric basis was returned.'
      )
    ).toBeOnTheScreen()
    expect(
      screen.queryByText('Provider-controlled ungrounded advice')
    ).not.toBeOnTheScreen()
    expect(screen.queryByText('This must never be shown.')).not.toBeOnTheScreen()
    expect(
      screen.queryByText('ADVICE BASIS — CONFIRMED METRICS')
    ).not.toBeOnTheScreen()
    expect(screen.getByText('Not a medical diagnosis')).toBeOnTheScreen()
    expect(screen.getByText(demoRecommendations.disclaimer)).toBeOnTheScreen()
  })

  test('keeps confirmed report results visible when advice loading fails', async () => {
    const report = { ...demoSavedReport, id: 'advice-failure-report' }
    const getReportRecommendations = jest
      .fn()
      .mockRejectedValue(new Error('Could not load current advice.'))
    mockAppState({
      getReports: jest.fn().mockResolvedValue([report]),
      getReportRecommendations,
    })

    await render(<ReportManager />)
    await screen.findByText('Health report')
    await fireEvent.press(
      screen.getByRole('button', { name: 'View report details' })
    )
    await fireEvent.press(
      await screen.findByRole('button', { name: 'View report recommendations' })
    )

    expect(await screen.findByText('Could not load current advice.')).toBeOnTheScreen()
    expect(screen.getByText('Confirmed results')).toBeOnTheScreen()
    expect(screen.getByText('Haemoglobin')).toBeOnTheScreen()
    expect(
      screen.queryByText('ADVICE BASIS — CONFIRMED METRICS')
    ).not.toBeOnTheScreen()
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
