import { expect, test } from 'vitest'

import {
  STEP_COUNT,
  answeredCount,
  buildCheckInInput,
  isStepAnswered,
  isTodaysCheckIn,
  nextStep,
  prevStep,
  progressRatio,
  shouldShowContinue,
  type CheckInAnswers,
} from './checkin.logic'

const empty: CheckInAnswers = {
  reportedEnergy: null,
  sleepDuration: null,
  lastMealTiming: null,
  lastMealDescription: '',
  hydration: null,
}

const full: CheckInAnswers = {
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  lastMealDescription: '',
  hydration: '1_1_5l',
}

test('buildCheckInInput returns null until every required answer is present', () => {
  expect(buildCheckInInput(empty, '2026-07-21')).toBeNull()
  expect(buildCheckInInput({ ...full, hydration: null }, '2026-07-21')).toBeNull()
})

test('buildCheckInInput assembles the contract input with the given date', () => {
  const input = buildCheckInInput(full, '2026-07-21')
  expect(input).toEqual({
    date: '2026-07-21',
    reportedEnergy: 4,
    sleepDuration: '7_8h',
    lastMealTiming: '1_3h',
    hydration: '1_1_5l',
  })
  // The optional meal note is omitted, not sent as an empty string.
  expect(input && 'lastMealDescription' in input).toBe(false)
})

test('buildCheckInInput trims the meal note and drops it when blank', () => {
  expect(buildCheckInInput({ ...full, lastMealDescription: '  salmon bowl  ' }, '2026-07-21'))
    .toMatchObject({ lastMealDescription: 'salmon bowl' })
  expect(buildCheckInInput({ ...full, lastMealDescription: '   ' }, '2026-07-21'))
    .not.toHaveProperty('lastMealDescription')
})

test('isStepAnswered tracks the answer that belongs to each step', () => {
  expect(isStepAnswered(0, empty)).toBe(false)
  expect(isStepAnswered(0, { ...empty, reportedEnergy: 3 })).toBe(true)
  expect(isStepAnswered(1, { ...empty, sleepDuration: '6_7h' })).toBe(true)
  expect(isStepAnswered(2, { ...empty, lastMealTiming: 'within_1h' })).toBe(true)
  expect(isStepAnswered(3, { ...empty, hydration: 'over_2l' })).toBe(true)
})

test('answeredCount counts the four scoring answers, not the meal note', () => {
  expect(answeredCount(empty)).toBe(0)
  expect(answeredCount({ ...empty, lastMealDescription: 'note only' })).toBe(0)
  expect(answeredCount(full)).toBe(4)
})

test('progressRatio and the "Step n/4" label stay coherent in update mode', () => {
  // Regression for the bar reading 100% while the label said Step 1/4: the
  // fill is driven by the current step, not by how many answers are pre-filled.
  expect(progressRatio(0, full)).toBeCloseTo(1 / STEP_COUNT)
  expect(progressRatio(0, empty)).toBe(0)
  expect(progressRatio(STEP_COUNT - 1, full)).toBe(1)
})

test('shouldShowContinue reveals Continue on any answered step, in both modes', () => {
  // Regression: navigating back to an answered step 0/1 in first-run mode used
  // to leave no Continue button.
  expect(shouldShowContinue(0, { ...empty, reportedEnergy: 4 })).toBe(true)
  expect(shouldShowContinue(1, { ...empty, sleepDuration: '7_8h' })).toBe(true)
  expect(shouldShowContinue(0, empty)).toBe(false)
  // The meal step always offers Continue (its chip does not auto-advance).
  expect(shouldShowContinue(2, empty)).toBe(true)
  // Never on the last step — that panel owns the submit button.
  expect(shouldShowContinue(STEP_COUNT - 1, full)).toBe(false)
})

test('nextStep and prevStep stay within bounds', () => {
  expect(nextStep(0)).toBe(1)
  expect(nextStep(STEP_COUNT - 1)).toBe(STEP_COUNT - 1)
  expect(prevStep(2)).toBe(1)
  expect(prevStep(0)).toBe(0)
})

test('isTodaysCheckIn only treats a same-day check-in as an update', () => {
  // Regression for the app left open across midnight: yesterday's check-in
  // must not pre-fill or flip the header to "Update".
  expect(isTodaysCheckIn({ date: '2026-07-21' }, '2026-07-21')).toBe(true)
  expect(isTodaysCheckIn({ date: '2026-07-20' }, '2026-07-21')).toBe(false)
  expect(isTodaysCheckIn(null, '2026-07-21')).toBe(false)
})
