-- Issue #55: deterministic multi-signal energy scoring, replay metadata and
-- owner-scoped follow-up calibration.
--
-- Existing v1 rows remain readable and explicitly retain their original
-- algorithm identity. No historical score is silently recomputed.

alter table checkin
  add column local_hour smallint check (local_hour between 0 and 23);

alter table energy_result
  add column algorithm_version text not null default 'energy-v1-self-report',
  add column confidence numeric(3, 2) not null default 0.50
    check (confidence between 0 and 1),
  add column personal_baseline jsonb not null default
    '{"score":60,"sampleSize":0,"source":"cold_start"}'::jsonb,
  add column baseline_delta smallint,
  add column baseline_explanation text;

update energy_result
set
  baseline_delta = score - 60,
  baseline_explanation =
    'Historical v1 score compared with the safe cold-start baseline.';

alter table energy_result
  alter column baseline_delta set not null,
  alter column baseline_explanation set not null,
  add constraint energy_result_baseline_delta_range
    check (baseline_delta between -100 and 100);

create table energy_calibration (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  actual_energy  smallint not null check (actual_energy between 1 and 5),
  recorded_at    timestamptz not null,
  unique (user_id, date)
);

alter table energy_calibration enable row level security;
create policy "energy_calibration: owner read/write" on energy_calibration
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index checkin_user_date_history_idx on checkin (user_id, date desc);
create index energy_calibration_user_date_history_idx
  on energy_calibration (user_id, date desc);
