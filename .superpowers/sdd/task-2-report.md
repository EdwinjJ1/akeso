# Task 2: Dashboard Daily-update Reminder

## Delivered

- Added `latestCheckIn` state, `loadLatestCheckIn(date)`, and dashboard-refresh loading through `AkesoService.getLatestCheckIn(date)`.
- The dashboard selects the `daily` prompt when a previous check-in exists and no energy result is available; otherwise it selects `first`.
- Added first-time and returning-user prompt-variant coverage, including an assertion that the daily prompt has no stale `/ 100` score.

## TDD evidence

### RED

1. Created `apps/app/src/components/home/checkin-prompt.test.tsx` before changing production code.
2. The initial required command failed because React Native Testing Library 14's `render` is asynchronous, so the brief's synchronous `screen.getByText` calls were operating on a Promise rather than a render result.
3. After awaiting `render`, the focused command failed for the intended feature behavior:

   ```text
   FAIL src/components/home/checkin-prompt.test.tsx
   ✕ reminds a returning user to update today without showing a stale score
   Unable to find an element with text: Update today’s status
   ```

### GREEN

1. Implemented the `first` and `daily` prompt variants with the specified copy.
2. The daily title and button intentionally have the same required label. The test therefore uses `getAllByText(...).toHaveLength(2)` instead of the brief's `getByText`, which would correctly fail due to those two elements.
3. Focused verification:

   ```text
   npm test --workspace=apps/app -- src/components/home/checkin-prompt.test.tsx
   Test Suites: 1 passed, 1 total
   Tests:       2 passed, 2 total
   ```

## Final verification

```text
npm test --workspace=apps/app
Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total

npm run typecheck
tsc --noEmit -p apps/app && tsc --noEmit -p packages/domain
exit 0

git diff --check
exit 0
```

## Self-review

- Checked each requested Task 2 interface, data load, dashboard selection, and exact prompt copy against the task brief.
- Preserved user-owned modifications in `docs/superpowers/specs/2026-07-21-rolling-checkin-design.md` and `apps/app/src/app/checkin.tsx`; neither is staged or committed by this task.

## Review-fix evidence (2026-07-21)

### Scope

- Added `energyDate` to app state. `refreshToday()` clears cached energy and latest check-in before loading, records the `todayISO()` date with a successful energy result, and leaves the cache clear on failure. `submitCheckIn()` also records the result date.
- Added the pure `selectDashboardContent()` boundary, which only exposes an energy result when `energyDate === todayISO()`, suppresses prompts for loading/error states, and selects `daily` or `first` after a completed no-score load.
- Replaced the passive error card with `DashboardLoadError`, retaining `Could not load today’s data. Pull to retry.` and adding a `Retry` button wired to `refreshToday()`.

### TDD evidence

1. RED — added `apps/app/src/components/home/dashboard-content.test.ts` and `apps/app/src/components/home/dashboard-load-error.test.tsx` before either production module. Command:

   ```text
   npm test --workspace=apps/app -- src/components/home/dashboard-content.test.ts src/components/home/dashboard-load-error.test.tsx
   FAIL: Cannot find module './dashboard-content'
   FAIL: Cannot find module './dashboard-load-error'
   Test Suites: 2 failed, 2 total
   ```

2. GREEN — implemented the pure selector, retry card, and state/dashboard wiring. Focused command:

   ```text
   npm test --workspace=apps/app -- src/components/home/dashboard-content.test.ts src/components/home/dashboard-load-error.test.tsx src/components/home/checkin-prompt.test.tsx
   Test Suites: 3 passed, 3 total
   Tests:       7 passed, 7 total
   ```

### Final verification

```text
npm test --workspace=apps/app
Test Suites: 4 passed, 4 total
Tests:       10 passed, 10 total

npm run typecheck
tsc --noEmit -p apps/app && tsc --noEmit -p packages/domain
exit 0

git diff --check
exit 0
```
