-- Remodel the check-in shape (Issue #6 contract → #3 data layer).
--
-- The old check-in captured sleep_hours / sleep_quality / mood / stress /
-- energy_now / caffeine / notes. The new four-step check-in captures a
-- self-reported energy plus three bucketed context fields. The old numeric
-- columns have no meaningful mapping onto the new enum buckets, so there is
-- no backfill: any existing check-in rows are cleared before the reshape.
-- Column names/constraints must stay in lockstep with
-- apps/api/src/repos/supabase.ts and packages/domain/src/schemas.ts.

-- No backfill path from the old model → start the reshaped table empty so the
-- new NOT NULL columns can be added even if 0001 rows already exist. Derived
-- energy_result rows are cleared too, since they were computed from the old
-- check-ins.
delete from energy_result;
delete from checkin;

alter table checkin
  drop column sleep_hours,
  drop column sleep_quality,
  drop column mood,
  drop column stress,
  drop column energy_now,
  drop column caffeine,
  drop column notes,
  add column reported_energy smallint not null check (reported_energy between 1 and 5),
  add column sleep_duration text not null check (
    sleep_duration in ('under_5h', '5_6h', '6_7h', '7_8h', '8_9h', 'over_9h', 'not_sure')
  ),
  add column last_meal_timing text not null check (
    last_meal_timing in ('within_1h', '1_3h', '3_5h', 'over_5h', 'not_today', 'not_sure')
  ),
  add column last_meal_description text,
  add column hydration text not null check (
    hydration in ('under_0_5l', '0_5_1l', '1_1_5l', '1_5_2l', 'over_2l', 'not_sure')
  );
