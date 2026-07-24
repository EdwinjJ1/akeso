import type {
  Hydration,
  LastMealTiming,
  Scale1to5,
  SleepDuration,
} from '@akeso/domain'

import type { ChipOption } from '@/components/ui/chips'

/**
 * The single source of the check-in answer choices, shared by the check-in
 * flow and the receipt's per-factor edit sheet so both always offer the
 * same values and labels.
 */

const scaleOptions = (
  labels: [string, string, string, string, string]
): ChipOption<Scale1to5>[] =>
  labels.map((label, index) => ({ value: (index + 1) as Scale1to5, label }))

export const ENERGY_OPTIONS = scaleOptions([
  'Drained',
  'Low',
  'OK',
  'Good',
  'Charged',
])

export const SLEEP_OPTIONS: ChipOption<SleepDuration>[] = [
  { value: 'under_5h', label: 'Under 5h' },
  { value: '5_6h', label: '5–6h' },
  { value: '6_7h', label: '6–7h' },
  { value: '7_8h', label: '7–8h' },
  { value: '8_9h', label: '8–9h' },
  { value: 'over_9h', label: 'Over 9h' },
  { value: 'not_sure', label: 'Not sure' },
]

export const MEAL_OPTIONS: ChipOption<LastMealTiming>[] = [
  { value: 'within_1h', label: 'Within 1h' },
  { value: '1_3h', label: '1–3h ago' },
  { value: '3_5h', label: '3–5h ago' },
  { value: 'over_5h', label: 'Over 5h ago' },
  { value: 'not_today', label: 'Not yet today' },
  { value: 'not_sure', label: 'Not sure' },
]

export const HYDRATION_OPTIONS: ChipOption<Hydration>[] = [
  { value: 'under_0_5l', label: 'Under 0.5L' },
  { value: '0_5_1l', label: '0.5–1L' },
  { value: '1_1_5l', label: '1–1.5L' },
  { value: '1_5_2l', label: '1.5–2L' },
  { value: 'over_2l', label: 'Over 2L' },
  { value: 'not_sure', label: 'Not sure' },
]
