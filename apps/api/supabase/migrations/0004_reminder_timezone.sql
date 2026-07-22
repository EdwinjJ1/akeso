-- Add the timezone the reminder time was set in (Issue #20).
--
-- Phase 1 of daily reminders schedules notifications on-device (the phone's
-- own clock handles DST), so nothing reads this column yet — it's captured
-- now so a future server-side push scheduler doesn't need another
-- migration to know which timezone `check_in_time` is local to.
--
-- No rows exist yet (issue #17 shipped the table ahead of any UI that writes
-- to it), so no backfill is needed for existing data.

alter table reminder_preference
  add column timezone text not null;
