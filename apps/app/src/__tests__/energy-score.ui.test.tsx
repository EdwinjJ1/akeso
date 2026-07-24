import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { fixtureEnergyResult } from '@akeso/domain'

import { ReadyDashboard } from '../app/(tabs)'

const onRetry = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
const onCalibrate =
  jest
    .fn<(date: string, value: 1 | 2 | 3 | 4 | 5) => Promise<void>>()
    .mockResolvedValue(undefined)

describe('personalized energy score dashboard', () => {
  beforeEach(() => jest.clearAllMocks())

  test('shows confidence, baseline change, algorithm and signed factors', async () => {
    await render(
      <ReadyDashboard
        energy={fixtureEnergyResult}
        warning={null}
        plan={null}
        planLoading={false}
        planError={null}
        nutrition={null}
        coach={null}
        coachLoading={false}
        coachError={null}
        onRetry={onRetry}
        onCalibrate={onCalibrate}
      />
    )

    expect(screen.getByText('76% signal confidence')).toBeOnTheScreen()
    expect(screen.getByText('+23 today')).toBeOnTheScreen()
    expect(
      screen.getByText('Model energy-v2-multisignal')
    ).toBeOnTheScreen()
    expect(screen.getByText('4 supporting · 1 headwind')).toBeOnTheScreen()
    expect(screen.getByText('+12')).toBeOnTheScreen()
    expect(screen.getByText('-2')).toBeOnTheScreen()
  })

  test('saves calibration for future scores without changing today', async () => {
    await render(
      <ReadyDashboard
        energy={fixtureEnergyResult}
        warning={null}
        plan={null}
        planLoading={false}
        planError={null}
        nutrition={null}
        coach={null}
        coachLoading={false}
        coachError={null}
        onRetry={onRetry}
        onCalibrate={onCalibrate}
      />
    )

    await fireEvent.press(
      screen.getByRole('button', { name: 'Calibrate energy 4 out of 5' })
    )

    await waitFor(() =>
      expect(onCalibrate).toHaveBeenCalledWith(fixtureEnergyResult.date, 4)
    )
    expect(screen.getByText('Saved for future scores.')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'This never changes today’s saved score. It only improves future personal baselines.'
      )
    ).toBeOnTheScreen()
    expect(screen.getByText('83')).toBeOnTheScreen()
  })
})
