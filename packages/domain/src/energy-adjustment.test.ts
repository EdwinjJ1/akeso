import { expect, test } from 'vitest'

import { applyScoreAdjustment } from './energy-adjustment'
import { EnergyEngine } from './energy-engine'
import type { CheckInInput } from './types'

const engine = new EnergyEngine()

const checkIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

const ADJUSTED_AT = '2026-07-21T10:30:00.000Z'

const baseResult = () => engine.evaluate(checkIn)

test('adjusting the score re-derives band, curve, windows and headline', () => {
  const adjusted = applyScoreAdjustment(baseResult(), 30, {
    adjustedAt: ADJUSTED_AT,
  })

  expect(adjusted.score).toBe(30)
  expect(adjusted.band).toBe('low')
  // The curve is the circadian shape shifted onto the new score.
  const reference = engine.evaluate({ ...checkIn, reportedEnergy: 1 })
  expect(adjusted.curve.map((p) => p.hour)).toEqual(
    reference.curve.map((p) => p.hour)
  )
  expect(adjusted.headline).toContain('Lower-energy day')
  expect(adjusted.peakWindow.endHour).toBeGreaterThan(
    adjusted.peakWindow.startHour
  )
})

test('adjustment provenance keeps the engine score and the note', () => {
  const adjusted = applyScoreAdjustment(baseResult(), 60, {
    note: 'Rough sleep the app did not know about',
    adjustedAt: ADJUSTED_AT,
  })

  expect(adjusted.adjustment).toEqual({
    originalScore: 80,
    adjustedScore: 60,
    note: 'Rough sleep the app did not know about',
    adjustedAt: ADJUSTED_AT,
  })
})

test('repeated adjustments keep the first engine score as the original', () => {
  const once = applyScoreAdjustment(baseResult(), 60, {
    adjustedAt: ADJUSTED_AT,
  })
  const twice = applyScoreAdjustment(once, 90, { adjustedAt: ADJUSTED_AT })

  expect(twice.adjustment?.originalScore).toBe(80)
  expect(twice.adjustment?.adjustedScore).toBe(90)
  expect(twice.score).toBe(90)
  expect(twice.band).toBe('high')
})

test('scores are clamped and rounded into the contract range', () => {
  expect(
    applyScoreAdjustment(baseResult(), 240, { adjustedAt: ADJUSTED_AT }).score
  ).toBe(100)
  expect(
    applyScoreAdjustment(baseResult(), -10, { adjustedAt: ADJUSTED_AT }).score
  ).toBe(0)
  expect(
    applyScoreAdjustment(baseResult(), 64.6, { adjustedAt: ADJUSTED_AT }).score
  ).toBe(65)
})

test('factors, date and computedAt are untouched by an adjustment', () => {
  const before = baseResult()
  const adjusted = applyScoreAdjustment(before, 55, { adjustedAt: ADJUSTED_AT })

  expect(adjusted.factors).toEqual(before.factors)
  expect(adjusted.date).toBe(before.date)
  expect(adjusted.computedAt).toBe(before.computedAt)
  // Pure function: the input result is not mutated.
  expect(before.score).toBe(80)
  expect(before.adjustment).toBeUndefined()
})

test('a whitespace-only note is dropped rather than stored', () => {
  const adjusted = applyScoreAdjustment(baseResult(), 50, {
    note: '   ',
    adjustedAt: ADJUSTED_AT,
  })
  expect(adjusted.adjustment?.note).toBeUndefined()
})
