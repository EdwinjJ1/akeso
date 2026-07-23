import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { fixtureProfile } from '@akeso/domain'

import { FixtureService } from '@/services/fixture-service'
import { useAppState } from '@/state/app-state'

import { ReportManager } from './report-manager'

jest.mock('@/state/app-state', () => ({ useAppState: jest.fn() }))
const mockRouterPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useFocusEffect: (callback: () => void | (() => void)) => {
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

const flushAsyncWork = async () => {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve()
    }
  })
}

describe('Issue 53 report fixture end-to-end flow', () => {
  let service: FixtureService

  beforeEach(async () => {
    jest.clearAllMocks()
    service = new FixtureService(0)
    await service.saveProfile(fixtureProfile)
    mockedUseAppState.mockReturnValue({
      profile: fixtureProfile,
      extractReportMetrics: (image) => service.extractReportMetrics(image),
      getReports: () => service.getReports(),
      getReport: (id) => service.getReport(id),
      saveReport: (input) => service.saveReport(input),
      updateReport: (id, input) => service.updateReport(id, input),
      updateReportMetrics: (id, input) =>
        service.updateReportMetrics(id, input),
      deleteReport: (id) => service.deleteReport(id),
      getReportRecommendations: (id) =>
        service.getReportRecommendations(id),
      regenerateReportRecommendations: (id) =>
        service.regenerateReportRecommendations(id),
    } as unknown as ReturnType<typeof useAppState>)
  })

  test('uploads, reviews, corrects, saves, opens, updates advice and deletes', async () => {
    const manager = await render(<ReportManager />)

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Load High & low flags report fixture',
      })
    )
    await flushAsyncWork()
    expect(await screen.findByDisplayValue('Ferritin')).toBeOnTheScreen()
    expect(screen.getByText('Below report range')).toBeOnTheScreen()
    expect(screen.getByText('Above report range')).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Confirm Haemoglobin' })
    )
    await fireEvent.changeText(screen.getByLabelText('Result for Ferritin'), '42')
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Confirm Ferritin' })
    )
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Save reviewed metrics and continue',
      })
    )
    await flushAsyncWork()

    expect(await screen.findByText('Report saved')).toBeOnTheScreen()
    const saved = (await service.getReports()).find(
      (report) => report.name === 'Flagged pathology fixture'
    )
    expect(saved).toBeDefined()
    expect(saved?.metrics.find((metric) => metric.id === 'ferritin')).toMatchObject(
      { value: 42, status: 'normal', confirmed: true }
    )
    expect(saved?.metrics.find((metric) => metric.id === 'ldl-cholesterol')).toMatchObject(
      { confirmed: false }
    )

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'View details for Flagged pathology fixture',
      })
    )
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/report/[id]',
      params: { id: saved!.id },
    })
    manager.unmount()

    const initialAdvice = await service.getReportRecommendations(saved!.id)
    expect(initialAdvice.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ferritin', value: 42 }),
      ])
    )
    expect(initialAdvice.metrics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ldl-cholesterol' }),
      ])
    )

    await service.updateReportMetrics(saved!.id, {
      metrics: saved!.metrics.map((metric) =>
        metric.id === 'ferritin'
          ? { ...metric, value: 18, confirmed: true }
          : metric
      ),
    })
    const updatedAdvice = await service.regenerateReportRecommendations(
      saved!.id
    )
    expect(updatedAdvice.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ferritin', value: 18, status: 'low' }),
      ])
    )
    expect(updatedAdvice.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'follow_up' }),
      ])
    )

    await service.deleteReport(saved!.id)
    await expect(service.getReport(saved!.id)).rejects.toThrow('Report not found')
  })
})
