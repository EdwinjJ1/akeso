# Rolling Daily Check-in Design

## Goal

Make the check-in a one-time full setup followed by lightweight daily updates. Each new day starts with the user's most recent answers prefilled. The user changes only what is different, confirms the form, and receives a newly calculated score for that day.

## User Experience

### First check-in

- A user with no previous check-in sees the existing empty six-question form.
- All six required answers must be completed before submission.
- The primary action reads `Get my energy plan`.

### Start of a new day

- The dashboard does not present an older score as today's score.
- Instead, it presents an `Update today's status` reminder.
- Opening the reminder loads the most recent check-in answers into the form.
- The form begins at `6 / 6`; the user may change only the answers that are different.
- The user may confirm the inherited answers without changing any field.
- The primary action reads `Update my energy score`.

### Repeated updates on the same day

- Opening the form again loads the latest answers saved for today.
- Submitting again replaces today's check-in and recalculates today's energy result.
- The dashboard then displays the updated score, plan, nutrition guidance, and coach response.

### Notes and failures

- Notes are inherited with the other answers and may be edited or cleared.
- While the form is loading its initial values, it must not briefly show an empty first-time form.
- If loading inherited answers fails, the form shows a recoverable error and does not silently treat the user as new.
- If saving fails, the user's current edits remain in the form so the submission can be retried.

## Data Model and Service Contract

Add a read operation that returns the most recent `CheckInInput`, or `null` when no check-in exists. The real API should resolve the latest record at or before the requested local date. The fixture service keeps the latest submitted input in memory and exposes the same behavior.

The existing `submitCheckIn(input)` operation remains the write path. A submission for a date is an upsert: the first submission creates that day's check-in, and later submissions for the same date replace it and trigger a fresh score calculation.

The dashboard continues to request energy by today's local date. Therefore an old energy result cannot be mistaken for today's result. When today's result is absent but a prior check-in exists, the dashboard shows the daily update reminder.

## State and Data Flow

1. The app refreshes today's dashboard data.
2. If today's energy exists, the dashboard displays it and offers `Update check-in`.
3. If today's energy does not exist, the dashboard displays `Update today's status`.
4. The check-in screen requests the most recent answers for today or an earlier date.
5. If answers exist, the screen initializes all controls from them; otherwise it initializes an empty first-time form.
6. The user submits a complete form using today's local date.
7. The service upserts today's check-in and recalculates the energy result.
8. App state refreshes the dependent plan, nutrition, and coach data before returning to the dashboard.

## Component Changes

- `AkesoService`: add `getLatestCheckIn(date)`, returning the latest input whose local date is at or before `date`.
- `FixtureService`: retain submitted check-in inputs separately from computed energy and return the latest applicable input.
- `AppStateProvider`: store `latestCheckIn`, fetch it with the dashboard refresh, and expose `loadLatestCheckIn(date)` so a directly opened form can load it independently.
- `CheckIn`: distinguish loading, first-time, and update modes; prefill inherited answers; update copy and retry behavior.
- `CheckInPrompt`: support daily-update copy when prior answers exist, while preserving first-time onboarding copy for a new user.
- `Dashboard`: choose first-time versus daily-update prompt without displaying stale energy.

## Testing

Tests will cover these behaviors before production code is changed:

- A first-time user receives no recent answers.
- A next-day request receives the latest prior answers.
- Multiple submissions on the same day return the latest saved answers.
- Updating any inherited answer produces a freshly computed score.
- The check-in form maps loaded answers to all six controls and notes.
- The dashboard distinguishes a first-time prompt from a daily-update reminder.
- Loading and submission failures preserve a recoverable UI state.

## Scope

This change does not introduce selective questions, automatic scoring before user confirmation, background reminders, push notifications, or a history screen. Those can be added later without changing the daily snapshot model.
