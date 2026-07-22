import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  buildReportRecommendationsFallback,
  type HealthReport,
} from '@akeso/domain'

import { useAppState } from '@/state/app-state'

import { demoRecommendations, demoSavedReport } from './report-demo'
import { ReportDetail } from './report-detail'

jest.mock('@/state/app-state', () => ({ useAppState: jest.fn() }))

const mockedUseAppState = jest.mocked(useAppState)

describe('ReportDetail', () => {
  const getReport = jest.fn()
  const updateReport = jest.fn()
  const updateReportMetrics = jest.fn()
  const deleteReport = jest.fn()
  const getReportRecommendations = jest.fn()
  const regenerateReportRecommendations = jest.fn()
  const onBack = jest.fn()
  const onDeleted = jest.fn()
  let currentReport: HealthReport

  beforeEach(() => {
    jest.clearAllMocks()
    currentReport = demoSavedReport
    getReport.mockImplementation(async () => currentReport)
    getReportRecommendations.mockResolvedValue(demoRecommendations)
    updateReport.mockImplementation(async (_id, input) => {
      currentReport = { ...currentReport, ...input }
      return currentReport
    })
    updateReportMetrics.mockImplementation(async (_id, input) => {
      currentReport = { ...currentReport, metrics: input.metrics }
      return currentReport
    })
    regenerateReportRecommendations.mockImplementation(async () =>
      buildReportRecommendationsFallback({ report: currentReport })
    )
    deleteReport.mockResolvedValue(undefined)
    mockedUseAppState.mockReturnValue({
      getReport,
      updateReport,
      updateReportMetrics,
      deleteReport,
      getReportRecommendations,
      regenerateReportRecommendations,
    } as unknown as ReturnType<typeof useAppState>)
  })

  test('shows report metadata, every review state, and confirmed-only evidence', async () => {
    await render(
      <ReportDetail
        reportId={demoSavedReport.id}
        onBack={onBack}
        onDeleted={onDeleted}
      />
    )

    expect(await screen.findByText('All metrics')).toBeOnTheScreen()
    expect(screen.getByText('2026-07-18')).toBeOnTheScreen()
    expect(screen.getByText(/Unconfirmed — not used for advice/)).toBeOnTheScreen()
    expect(screen.getByText(/Low confidence \(61%\)/)).toBeOnTheScreen()
    expect(screen.getByText(/lower reference bound is faint/i)).toBeOnTheScreen()
    expect(screen.queryByText('Vitamin D: 48 nmol/L')).not.toBeOnTheScreen()
    expect(screen.getAllByText('BASED ON CONFIRMED').length).toBeGreaterThan(0)
  })

  test('persists every editable field, requires re-confirmation, then regenerates current advice', async () => {
    await render(
      <ReportDetail
        reportId={demoSavedReport.id}
        onBack={onBack}
        onDeleted={onDeleted}
      />
    )

    await screen.findByText('All metrics')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Edit report details and metrics' })
    )
    await fireEvent.changeText(screen.getByLabelText('Report name'), 'Corrected panel')
    await fireEvent.changeText(screen.getByLabelText('Report date'), '2026-07-19')
    await fireEvent.changeText(
      await screen.findByLabelText('Result for Haemoglobin'),
      '14.2'
    )
    await fireEvent.changeText(screen.getByLabelText('Unit for Haemoglobin'), 'g/dL')
    await fireEvent.changeText(
      screen.getByLabelText('Reference low for Haemoglobin'),
      '12'
    )
    await fireEvent.changeText(
      screen.getByLabelText('Reference high for Haemoglobin'),
      '16'
    )
    await fireEvent.changeText(
      screen.getByLabelText('Metric name for Haemoglobin'),
      'Haemoglobin corrected'
    )

    expect(screen.getByText('Advice needs updating')).toBeOnTheScreen()
    expect(
      screen.getByRole('checkbox', { name: 'Confirm Haemoglobin corrected' })
    ).not.toBeChecked()

    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Confirm Haemoglobin corrected' })
    )
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Save report changes and regenerate advice',
      })
    )

    await waitFor(() => {
      expect(updateReport).toHaveBeenCalledWith(demoSavedReport.id, {
        name: 'Corrected panel',
        reportDate: '2026-07-19',
      })
      expect(updateReportMetrics).toHaveBeenCalledTimes(1)
      expect(regenerateReportRecommendations).toHaveBeenCalledWith(
        demoSavedReport.id
      )
    })
    const input = updateReportMetrics.mock.calls[0][1]
    expect(input.metrics).toHaveLength(3)
    expect(input.metrics.find((metric) => metric.id === 'demo-haemoglobin')).toMatchObject({
      name: 'Haemoglobin corrected',
      value: 14.2,
      unit: 'g/dL',
      referenceLow: 12,
      referenceHigh: 16,
      confirmed: true,
      status: 'normal',
    })
    expect(input.metrics.find((metric) => metric.id === 'demo-vitamin-d')).toMatchObject({
      confirmed: false,
    })
    expect(
      await screen.findByText(
        'Changes confirmed. Advice was regenerated from current metrics.'
      )
    ).toBeOnTheScreen()
    expect(screen.getByText('Haemoglobin corrected: 14.2 g/dL')).toBeOnTheScreen()
  })

  test('confirms destructive deletion before returning to history', async () => {
    await render(
      <ReportDetail
        reportId={demoSavedReport.id}
        onBack={onBack}
        onDeleted={onDeleted}
      />
    )

    await screen.findByText('All metrics')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Delete this health report' })
    )
    expect(await screen.findByText('Delete this report?')).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Confirm delete report' })
    )
    await waitFor(() => {
      expect(deleteReport).toHaveBeenCalledWith(demoSavedReport.id)
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
  })

  test('keeps a durable correction marked stale when regeneration fails, then retries', async () => {
    regenerateReportRecommendations.mockRejectedValueOnce(
      new Error('Advice service unavailable.')
    )
    await render(
      <ReportDetail
        reportId={demoSavedReport.id}
        onBack={onBack}
        onDeleted={onDeleted}
      />
    )

    await screen.findByText('All metrics')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Edit report details and metrics' })
    )
    await fireEvent.changeText(
      await screen.findByLabelText('Result for Haemoglobin'),
      '126'
    )
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Confirm Haemoglobin' })
    )
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Save report changes and regenerate advice',
      })
    )

    expect(await screen.findByText('Advice service unavailable.')).toBeOnTheScreen()
    expect(screen.getByText('Advice needs updating')).toBeOnTheScreen()
    expect(updateReportMetrics).toHaveBeenCalledTimes(1)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Retry advice regeneration' })
    )
    expect(
      await screen.findByText('Advice regenerated from current confirmed metrics.')
    ).toBeOnTheScreen()
    expect(regenerateReportRecommendations).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Advice needs updating')).not.toBeOnTheScreen()
  })
})
