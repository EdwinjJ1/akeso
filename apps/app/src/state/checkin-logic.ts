import type {
  CheckInInput,
  Hydration,
  LastMealTiming,
  Scale1to5,
  SleepDuration,
} from '@akeso/domain'

/** Number of one-question steps in the daily check-in wizard. */
export const STEP_COUNT = 4

/** The raw wizard answers, before they are validated into a CheckInInput. */
export interface CheckInAnswers {
  reportedEnergy: Scale1to5 | null
  sleepDuration: SleepDuration | null
  lastMealTiming: LastMealTiming | null
  lastMealDescription: string
  hydration: Hydration | null
}

/**
 * Assemble a contract-shaped CheckInInput, or null while any required answer
 * is still missing. The optional meal note is trimmed and omitted when blank
 * so we never post an empty string.
 */
export function buildCheckInInput(
  answers: CheckInAnswers,
  date: string,
  localHour?: number
): CheckInInput | null {
  const { reportedEnergy, sleepDuration, lastMealTiming, hydration } = answers
  if (
    reportedEnergy === null ||
    sleepDuration === null ||
    lastMealTiming === null ||
    hydration === null
  ) {
    return null
  }

  const note = answers.lastMealDescription.trim()
  return {
    date,
    reportedEnergy,
    sleepDuration,
    lastMealTiming,
    hydration,
    ...(localHour === undefined ? {} : { localHour }),
    ...(note ? { lastMealDescription: note } : {}),
  }
}

/** Whether the answer that belongs to `step` has been provided. */
export function isStepAnswered(step: number, answers: CheckInAnswers): boolean {
  switch (step) {
    case 0:
      return answers.reportedEnergy !== null
    case 1:
      return answers.sleepDuration !== null
    case 2:
      return answers.lastMealTiming !== null
    default:
      return answers.hydration !== null
  }
}

/** How many of the four scoring answers are filled (the meal note is not one). */
export function answeredCount(answers: CheckInAnswers): number {
  return [
    answers.reportedEnergy,
    answers.sleepDuration,
    answers.lastMealTiming,
    answers.hydration,
  ].filter((value) => value !== null).length
}

/**
 * Progress fill for the bar, 0..1. Driven by the current step (plus the step's
 * own answer) rather than total answers filled, so it stays coherent with the
 * "Step n / 4" label even in update mode where every answer is pre-filled.
 */
export function progressRatio(step: number, answers: CheckInAnswers): number {
  const filledThroughStep = step + (isStepAnswered(step, answers) ? 1 : 0)
  return Math.min(filledThroughStep, STEP_COUNT) / STEP_COUNT
}

/**
 * Whether to show the "Continue" button. The meal step (2) always offers it —
 * its chip does not auto-advance — and any other non-final step offers it once
 * answered, so tapping back to review an answer never traps the user.
 */
export function shouldShowContinue(step: number, answers: CheckInAnswers): boolean {
  const isLastStep = step === STEP_COUNT - 1
  return !isLastStep && (step === 2 || isStepAnswered(step, answers))
}

/** Advance one step, clamped to the last step. */
export function nextStep(step: number): number {
  return Math.min(step + 1, STEP_COUNT - 1)
}

/** Go back one step, clamped to the first step. */
export function prevStep(step: number): number {
  return Math.max(step - 1, 0)
}

/**
 * Whether a stored check-in belongs to `today`. Used so a check-in left over
 * from a previous day (app open across midnight) is treated as a fresh
 * check-in rather than pre-filling and mislabelling the screen as an update.
 */
export function isTodaysCheckIn(
  latestCheckIn: { date: string } | null,
  today: string
): boolean {
  return latestCheckIn !== null && latestCheckIn.date === today
}
