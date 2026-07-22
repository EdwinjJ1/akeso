# Rolling Daily Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the latest check-in answers across days so users only update changed fields, while requiring daily confirmation before calculating and displaying today's score.

**Architecture:** Add a latest-check-in query to the shared service boundary and persist dated check-in inputs in the fixture service. App state loads both today's energy and the latest answers; the dashboard uses those two values to select a first-time or daily-update prompt, and the check-in screen independently loads and prefills the latest answers before rendering the editable form.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2, Expo Router, TypeScript 6, Jest with `jest-expo`, React Native Testing Library.

## Global Constraints

- Keep `CheckInInput` unchanged and continue using the user's local `YYYY-MM-DD` date.
- A prior day's energy must never be presented as today's score.
- Do not calculate a new day's score until the user confirms the prefilled form.
- A same-day submission replaces the existing same-day answers and recalculates all dependent results.
- Preserve edits after submission failures and show a retry path after initial-load failures.
- Use the Expo-supported `jest-expo` preset and `@testing-library/react-native`; React 19 does not support the deprecated `react-test-renderer` package directly.
- No history screen, selective-question engine, push notification, background reminder, or automatic unconfirmed scoring.

---

## File Map

- `packages/domain/src/service.ts`: shared `AkesoService` contract for retrieving the latest dated check-in.
- `apps/app/src/services/fixture-service.ts`: in-memory dated check-in storage, upsert behavior, and latest-at-or-before lookup.
- `apps/app/src/services/fixture-service.test.ts`: service behavior regression tests.
- `apps/app/src/state/app-state.tsx`: latest check-in state plus dashboard and direct-screen loading actions.
- `apps/app/src/components/home/checkin-prompt.tsx`: first-time and daily-update prompt variants.
- `apps/app/src/components/home/checkin-prompt.test.tsx`: prompt copy tests.
- `apps/app/src/app/(tabs)/index.tsx`: dashboard prompt-mode selection.
- `apps/app/src/app/checkin.tsx`: loading, prefill, retry, update-mode copy, and save behavior.
- `apps/app/src/app/checkin.test.tsx`: prefill, retry, and edit-preservation component tests.
- `apps/app/src/components/ui/chips.tsx`: accessible chip names used by users and component tests.
- `apps/app/package.json`, `package-lock.json`: Expo-compatible test runner and dependencies.

### Task 1: Test Harness and Latest Check-in Service

**Files:**
- Modify: `apps/app/package.json`
- Modify: `package-lock.json`
- Modify: `packages/domain/src/service.ts`
- Modify: `apps/app/src/services/fixture-service.ts`
- Create: `apps/app/src/services/fixture-service.test.ts`

**Interfaces:**
- Consumes: existing `CheckInInput` and `EnergyResult` types from `@akeso/domain`.
- Produces: `AkesoService.getLatestCheckIn(date: string): Promise<CheckInInput | null>`.

- [ ] **Step 1: Install and configure the Expo 57 test harness**

Run from the repository root:

```bash
npx expo install jest-expo @testing-library/react-native --dev --workspace=apps/app
npm install --save-dev @types/jest --workspace=apps/app
```

Add these exact entries to `apps/app/package.json`:

```json
{
  "scripts": {
    "test": "jest --runInBand"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
    ]
  }
}
```

Run: `npm test --workspace=apps/app -- --listTests`

Expected: exit 0 with no tests listed.

- [ ] **Step 2: Write failing service tests**

Create `apps/app/src/services/fixture-service.test.ts`:

```ts
import type { CheckInInput } from '@akeso/domain'

import { FixtureService } from './fixture-service'

const checkIn = (date: string, stress: CheckInInput['stress']): CheckInInput => ({
  date,
  sleepHours: 8,
  sleepQuality: 4,
  mood: 4,
  stress,
  energyNow: 4,
  caffeine: 'morning',
  notes: 'steady',
})

describe('FixtureService latest check-in', () => {
  test('returns null before the first check-in', async () => {
    const service = new FixtureService()
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toBeNull()
  })

  test('inherits the latest check-in at or before the requested day', async () => {
    const service = new FixtureService()
    await service.submitCheckIn(checkIn('2026-07-20', 2))
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toEqual(
      checkIn('2026-07-20', 2)
    )
  })

  test('same-day submission replaces answers and recalculates the score', async () => {
    const service = new FixtureService()
    const first = await service.submitCheckIn(checkIn('2026-07-21', 2))
    const updated = await service.submitCheckIn(checkIn('2026-07-21', 5))
    await expect(service.getLatestCheckIn('2026-07-21')).resolves.toEqual(
      checkIn('2026-07-21', 5)
    )
    expect(updated.score).toBeLessThan(first.score)
    await expect(service.getTodayEnergy('2026-07-21')).resolves.toEqual(updated)
  })
})
```

- [ ] **Step 3: Run the service tests and verify RED**

Run: `npm test --workspace=apps/app -- src/services/fixture-service.test.ts`

Expected: FAIL because `getLatestCheckIn` does not exist.

- [ ] **Step 4: Add the contract and minimal dated storage**

Add to `AkesoService` in `packages/domain/src/service.ts`:

```ts
/** Latest submitted answers at or before date; null before first check-in. */
getLatestCheckIn(date: string): Promise<CheckInInput | null>
```

In `FixtureService`, add storage and update the methods:

```ts
private checkIns = new Map<string, CheckInInput>()

async submitCheckIn(input: CheckInInput): Promise<EnergyResult> {
  await wait(LATENCY_MS * 2)
  this.checkIns.set(input.date, { ...input })
  this.energy = scoreCheckIn(input)
  return this.energy
}

async getLatestCheckIn(date: string): Promise<CheckInInput | null> {
  await wait(LATENCY_MS / 3)
  const latestDate = [...this.checkIns.keys()]
    .filter((checkInDate) => checkInDate <= date)
    .sort((left, right) => right.localeCompare(left))[0]
  const latest = latestDate ? this.checkIns.get(latestDate) : undefined
  return latest ? { ...latest } : null
}
```

- [ ] **Step 5: Run tests and typecheck to verify GREEN**

Run: `npm test --workspace=apps/app -- src/services/fixture-service.test.ts`

Expected: 3 tests pass.

Run: `npm run typecheck`

Expected: both app and domain typechecks exit 0.

- [ ] **Step 6: Commit the service slice**

```bash
git add apps/app/package.json package-lock.json packages/domain/src/service.ts apps/app/src/services/fixture-service.ts apps/app/src/services/fixture-service.test.ts
git commit -m "feat: retain latest check-in answers"
```

### Task 2: Dashboard Daily-update Reminder

**Files:**
- Modify: `apps/app/src/state/app-state.tsx`
- Modify: `apps/app/src/components/home/checkin-prompt.tsx`
- Create: `apps/app/src/components/home/checkin-prompt.test.tsx`
- Modify: `apps/app/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `AkesoService.getLatestCheckIn(date)` from Task 1.
- Produces: `latestCheckIn: CheckInInput | null`, `loadLatestCheckIn(date: string): Promise<CheckInInput | null>`, and `CheckInPrompt({ mode }: { mode: 'first' | 'daily' })`.

- [ ] **Step 1: Write failing prompt variant tests**

Create `apps/app/src/components/home/checkin-prompt.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { CheckInPrompt } from './checkin-prompt'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('CheckInPrompt', () => {
  test('invites a new user to start the first check-in', () => {
    const screen = render(<CheckInPrompt mode="first" />)
    screen.getByText('Start check-in')
    screen.getByText('How’s your energy, really?')
  })

  test('reminds a returning user to update today without showing a stale score', () => {
    const screen = render(<CheckInPrompt mode="daily" />)
    screen.getByText('Update today’s status')
    screen.getByText('Your last answers are ready — only change what feels different today.')
    expect(screen.queryByText(/\/ 100/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the prompt tests and verify RED**

Run: `npm test --workspace=apps/app -- src/components/home/checkin-prompt.test.tsx`

Expected: FAIL because `CheckInPrompt` has no `mode` prop or daily copy.

- [ ] **Step 3: Implement the prompt variants**

Change the signature and derive copy in `checkin-prompt.tsx`:

```tsx
interface CheckInPromptProps {
  mode: 'first' | 'daily'
}

export function CheckInPrompt({ mode }: CheckInPromptProps) {
  const returning = mode === 'daily'
  const kicker = returning ? 'A QUICK DAILY REFRESH' : '20 SECONDS, THAT’S IT'
  const title = returning ? 'Update today’s status' : 'How’s your energy, really?'
  const subtitle = returning
    ? 'Your last answers are ready — only change what feels different today.'
    : 'A 20-second check-in unlocks your energy score, today’s plan, and meals matched to what your body needs.'
  const buttonLabel = returning ? 'Update today’s status' : 'Start check-in'

  return (
    <Card tone="green" style={styles.card}>
      <View style={styles.mascot}><Mascot state="steady" size={120} /></View>
      <View style={styles.iconCircle}>
        <Ionicons name="sunny" size={20} color={colors.text} />
      </View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Button label={buttonLabel} onPress={() => router.push('/checkin')} variant="cta" />
    </Card>
  )
}
```

- [ ] **Step 4: Extend app state and dashboard selection**

Add `CheckInInput` to domain imports, add `latestCheckIn: CheckInInput | null` to `AppState` and `initialState`, and add this action:

```ts
loadLatestCheckIn(date: string): Promise<CheckInInput | null>
```

Implement it and reuse the service boundary:

```ts
const loadLatestCheckIn = useCallback(
  async (date: string) => {
    const latestCheckIn = await service.getLatestCheckIn(date)
    setState((prev) => ({ ...prev, latestCheckIn }))
    return latestCheckIn
  },
  [service]
)
```

Include `service.getLatestCheckIn(date)` in `refreshToday()`'s `Promise.all`, assign it to `latestCheckIn`, and expose `loadLatestCheckIn` in the memoized value and dependency list.

Update the dashboard:

```tsx
const { profile, energy, latestCheckIn, nutrition, coach, loading, error, refreshToday } =
  useAppState()

{!loading && !energy ? (
  <CheckInPrompt mode={latestCheckIn ? 'daily' : 'first'} />
) : null}
```

- [ ] **Step 5: Run tests and typecheck to verify GREEN**

Run: `npm test --workspace=apps/app -- src/components/home/checkin-prompt.test.tsx`

Expected: 2 tests pass.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit the dashboard slice**

```bash
git add apps/app/src/state/app-state.tsx apps/app/src/components/home/checkin-prompt.tsx apps/app/src/components/home/checkin-prompt.test.tsx 'apps/app/src/app/(tabs)/index.tsx'
git commit -m "feat: show daily status reminder"
```

### Task 3: Prefilled Update Form and Recovery States

**Files:**
- Modify: `apps/app/src/app/checkin.tsx`
- Create: `apps/app/src/app/checkin.test.tsx`
- Modify: `apps/app/src/components/ui/chips.tsx`

**Interfaces:**
- Consumes: `loadLatestCheckIn(date): Promise<CheckInInput | null>` and existing `submitCheckIn(input): Promise<EnergyResult>`.
- Produces: a form that waits for initialization, prefills all answers, uses update-mode copy, retries load errors, and preserves edits after save errors.

- [ ] **Step 1: Add accessible names to check-in chips**

Add this property to each chip `Pressable` in `chips.tsx`:

```tsx
accessibilityLabel={option.label}
```

- [ ] **Step 2: Write failing prefill and recovery tests**

Create `apps/app/src/app/checkin.test.tsx`:

```tsx
import type { CheckInInput } from '@akeso/domain'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import CheckIn from './checkin'

const back = jest.fn()
const loadLatestCheckIn = jest.fn<Promise<CheckInInput | null>, [string]>()
const submitCheckIn = jest.fn()

jest.mock('expo-router', () => ({ router: { back } }))
jest.mock('@/utils/dates', () => ({ todayISO: () => '2026-07-21' }))
jest.mock('@/state/app-state', () => ({
  useAppState: () => ({ loadLatestCheckIn, submitCheckIn }),
}))

const previous: CheckInInput = {
  date: '2026-07-20',
  sleepHours: 8,
  sleepQuality: 4,
  mood: 3,
  stress: 2,
  energyNow: 4,
  caffeine: 'morning',
  notes: 'deadline tomorrow',
}

beforeEach(() => jest.clearAllMocks())

test('prefills the latest answers and enters update mode', async () => {
  loadLatestCheckIn.mockResolvedValue(previous)
  const screen = render(<CheckIn />)
  screen.getByText('Loading your latest status…')
  await waitFor(() => screen.getByText('6 / 6'))
  expect(screen.getByRole('button', { name: '8h' })).toHaveAccessibilityState({ selected: true })
  expect(screen.getByRole('button', { name: 'Low' })).toHaveAccessibilityState({ selected: true })
  expect(screen.getByDisplayValue('deadline tomorrow')).toBeTruthy()
  screen.getByText('Update my energy score')
})

test('submits changed answers for today and recalculates', async () => {
  loadLatestCheckIn.mockResolvedValue(previous)
  submitCheckIn.mockResolvedValue({ score: 60 })
  const screen = render(<CheckIn />)
  await waitFor(() => screen.getByText('Update my energy score'))
  fireEvent.press(screen.getByRole('button', { name: 'Very high' }))
  fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() => expect(submitCheckIn).toHaveBeenCalledWith({
    ...previous,
    date: '2026-07-21',
    stress: 5,
  }))
  expect(back).toHaveBeenCalled()
})

test('keeps edited answers when saving fails', async () => {
  loadLatestCheckIn.mockResolvedValue(previous)
  submitCheckIn.mockRejectedValue(new Error('offline'))
  const screen = render(<CheckIn />)
  await waitFor(() => screen.getByText('Update my energy score'))
  fireEvent.press(screen.getByRole('button', { name: 'Very high' }))
  fireEvent.press(screen.getByText('Update my energy score'))
  await waitFor(() => screen.getByText('Something went wrong — please try again.'))
  expect(screen.getByRole('button', { name: 'Very high' })).toHaveAccessibilityState({ selected: true })
})

test('shows a retry action when latest answers cannot load', async () => {
  loadLatestCheckIn.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(previous)
  const screen = render(<CheckIn />)
  await waitFor(() => screen.getByText('Could not load your latest status.'))
  fireEvent.press(screen.getByText('Try again'))
  await waitFor(() => screen.getByText('Update my energy score'))
  expect(loadLatestCheckIn).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 3: Run the form tests and verify RED**

Run: `npm test --workspace=apps/app -- src/app/checkin.test.tsx`

Expected: FAIL because loading, prefill, retry, and update-mode behavior do not exist.

- [ ] **Step 4: Implement initialization and retry**

Import `useCallback` and `useEffect`, read `loadLatestCheckIn`, and add:

```tsx
const { loadLatestCheckIn, submitCheckIn } = useAppState()
const [initializing, setInitializing] = useState(true)
const [loadError, setLoadError] = useState<string | null>(null)
const [isUpdate, setIsUpdate] = useState(false)

const initialize = useCallback(async () => {
  setInitializing(true)
  setLoadError(null)
  try {
    const latest = await loadLatestCheckIn(todayISO())
    if (latest) {
      setSleepHours(latest.sleepHours)
      setSleepQuality(latest.sleepQuality)
      setMood(latest.mood)
      setStress(latest.stress)
      setEnergyNow(latest.energyNow)
      setCaffeine(latest.caffeine)
      setNotes(latest.notes ?? '')
      setIsUpdate(true)
    } else {
      setIsUpdate(false)
    }
  } catch (loadFailure) {
    console.error('Check-in load failed:', loadFailure)
    setLoadError('Could not load your latest status.')
  } finally {
    setInitializing(false)
  }
}, [loadLatestCheckIn])

useEffect(() => {
  void initialize()
}, [initialize])
```

Before the form return, add:

```tsx
if (initializing) {
  return (
    <Screen><View style={styles.statusState}>
      <Mascot state="steady" size={112} />
      <Text style={type.h3}>Loading your latest status…</Text>
    </View></Screen>
  )
}

if (loadError) {
  return (
    <Screen><View style={styles.statusState}>
      <Mascot state="steady" size={112} />
      <Text style={type.h3}>{loadError}</Text>
      <Button label="Try again" onPress={() => void initialize()} variant="cta" />
    </View></Screen>
  )
}
```

Use mode-aware heading and button copy:

```tsx
<Text style={type.h1}>{isUpdate ? 'Update today’s status' : 'Daily check-in'}</Text>

<Button
  label={complete ? (isUpdate ? 'Update my energy score' : 'Get my energy plan') : 'Answer all questions to continue'}
  onPress={submit}
  disabled={!complete}
  loading={submitting}
  variant="cta"
/>
```

Add the centered loading/error style:

```ts
statusState: {
  flex: 1,
  minHeight: 420,
  alignItems: 'center',
  justifyContent: 'center',
  gap: sp(4),
},
```

Use this save failure block so field state remains intact:

```ts
} catch (submitError) {
  console.error('Check-in failed:', submitError)
  setError('Something went wrong — please try again.')
  setSubmitting(false)
}
```

- [ ] **Step 5: Run form tests and full tests to verify GREEN**

Run: `npm test --workspace=apps/app -- src/app/checkin.test.tsx`

Expected: 4 tests pass.

Run: `npm test --workspace=apps/app`

Expected: all service, prompt, and form tests pass with zero failures.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit the form slice**

```bash
git add apps/app/src/app/checkin.tsx apps/app/src/app/checkin.test.tsx apps/app/src/components/ui/chips.tsx
git commit -m "feat: prefill daily check-in updates"
```

### Task 4: End-to-end Verification

**Files:**
- Verify only; if a defect is found, add a failing regression test before modifying the smallest relevant production file.

**Interfaces:**
- Consumes: all behavior from Tasks 1–3.
- Produces: verified first-use, next-day inheritance, and same-day update flows.

- [ ] **Step 1: Run automated verification**

```bash
npm test --workspace=apps/app
npm run typecheck
npm run lint --workspace=apps/app
```

Expected: every command exits 0, all tests pass, and lint reports no errors.

- [ ] **Step 2: Verify first-time UI manually**

Start with `npm run web --workspace=apps/app`, open `/checkin`, and confirm the loading state appears first, the first form is empty, all six answers are required, and submission creates today's dashboard score.

- [ ] **Step 3: Verify update UI manually**

Return to `/checkin` and confirm all answers and notes are restored, progress starts at `6 / 6`, the update copy appears, changing stress changes the saved score, and a second same-day visit loads the latest choices.

- [ ] **Step 4: Review the final diff against the design**

```bash
git diff HEAD~3 --check
git status --short
```

Expected: no whitespace errors and no unrelated files.
