# Plan Time Grid Picker Design

## Goal

Make plan suggestion times quick to change on touch devices. Users select a start or end time from a tap-friendly grid instead of typing a strict `HH:mm` value with the keyboard.

## Scope

This change affects the existing plan suggestion update sheet only. Title editing, completion status, saving, cancellation, overlap validation, and the `UpdatePlanBlockInput` contract remain unchanged.

An iOS-style wheel picker is not part of this iteration. The grid provides one consistent implementation for Expo Web, iOS, and Android without adding a native dependency. A platform-specific wheel can be added later without changing the stored time format.

## Interaction Design

The Start and End text inputs become pressable time fields. Each field continues to display a zero-padded 24-hour value such as `08:55`.

Pressing either field switches the existing bottom sheet from the edit form to a dedicated time-selection view. This avoids placing a large grid beneath the form and keeps the layout usable on short phone screens.

The selection view contains:

- A heading identifying whether the user is choosing the start or end time.
- A large preview of the currently selected `HH:mm` value.
- An hour grid containing `00` through `23`.
- A minute grid containing `00` through `55` in five-minute increments.
- A highlighted state for the selected hour and minute.
- A `Cancel` action that discards changes made in the selector and returns to the edit form.
- A primary `Use HH:mm` action that applies the selected time to the draft and returns to the edit form.

Returning to the form does not save the plan block. The user must still select `Save changes` to persist the complete draft.

## Component Design

Add a focused `TimeGridPicker` component under `apps/app/src/components/plan/`. It receives:

- the field label (`Start` or `End`);
- the current `HH:mm` value;
- an `onCancel` callback;
- an `onConfirm` callback that returns an `HH:mm` value.

`PlanBlockUpdateSheet` owns which time field is active and conditionally renders either the existing edit form or `TimeGridPicker`. The picker owns only its temporary hour and minute selection. This boundary keeps plan validation and save behavior in the update sheet while making the picker independently testable.

## Data and Validation

Times remain strings in 24-hour `HH:mm` format, matching `UpdatePlanBlockInput`. The picker parses the existing value into hour and minute state and emits a zero-padded string on confirmation.

The picker only emits structurally valid values. Existing schema validation continues to enforce a non-empty title and a valid time range, while the update sheet continues to reject overlaps with other suggestions. Invalid or overlapping drafts remain visible so the user can correct them.

Existing fixture times are all representable because the minute grid uses five-minute increments, including values such as `08:55`.

## Accessibility

The Start and End fields remain keyboard accessible pressable controls with explicit labels. Hour and minute choices expose button roles and selected state. The preview and confirmation label communicate the complete selected time rather than relying on color alone.

## Testing

Use React Native Testing Library to cover:

1. Pressing Start opens the start-time picker with the current hour and minute selected.
2. Selecting an hour and minute and confirming updates the Start field without saving the block.
3. Cancelling the picker leaves the draft time unchanged.
4. Pressing End operates on the End field independently.
5. Saving after selection sends the selected `HH:mm` values through the existing update callback.
6. Existing invalid-range and overlap behavior remains intact.

The implementation follows red-green-refactor: add a failing interaction test, implement the smallest picker behavior, then refactor while keeping the focused and full test suites green.
