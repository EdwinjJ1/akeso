-- Akeso MVP data layer (Issue #3 / API_CONTRACT.md v1).
-- Table shapes match apps/api/src/repos/supabase.ts exactly — if you
-- change a column here, update that file (and vice versa).
--
-- User identity comes from Supabase Auth (auth.users); every business
-- table just stores a user_id reference. RLS is enabled as defense in
-- depth even though the API always talks to Postgres with the service
-- role key (which bypasses RLS) — a stray anon-key client should still
-- see nothing.

create extension if not exists pgcrypto;

-- ── Profile ──────────────────────────────────────────────────────────────

create table user_profile (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null,
  goal                text not null check (goal in ('academic', 'work', 'fitness', 'balance')),
  typical_wake        text not null check (typical_wake ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  typical_sleep       text not null check (typical_sleep ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  dietary_preference  text not null check (
    dietary_preference in ('none', 'vegetarian', 'vegan', 'halal', 'gluten_free')
  ),
  updated_at          timestamptz not null default now()
);

alter table user_profile enable row level security;
create policy "user_profile: owner read/write" on user_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Check-ins ────────────────────────────────────────────────────────────

create table checkin (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  sleep_hours    numeric(3, 1) not null check (sleep_hours >= 0 and sleep_hours <= 14),
  sleep_quality  smallint not null check (sleep_quality between 1 and 5),
  mood           smallint not null check (mood between 1 and 5),
  stress         smallint not null check (stress between 1 and 5),
  energy_now     smallint not null check (energy_now between 1 and 5),
  caffeine       text not null check (caffeine in ('none', 'morning', 'afternoon', 'evening')),
  notes          text,
  created_at     timestamptz not null default now(),
  unique (user_id, date)
);

alter table checkin enable row level security;
create policy "checkin: owner read/write" on checkin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Energy results (EnergyEngine output) ────────────────────────────────

create table energy_result (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  score        smallint not null check (score between 0 and 100),
  band         text not null check (band in ('low', 'moderate', 'high')),
  headline     text not null,
  factors      jsonb not null,
  curve        jsonb not null,
  peak_window  jsonb not null,
  dip_window   jsonb not null,
  computed_at  timestamptz not null,
  unique (user_id, date)
);

alter table energy_result enable row level security;
create policy "energy_result: owner read/write" on energy_result
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Tasks ────────────────────────────────────────────────────────────────
-- No create/update endpoint exists yet (Issue #3 only reads tasks) —
-- this table exists so GET /v1/tasks has something to serve and so a
-- future task-management feature has a home.

create table task (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  title              text not null,
  priority           text not null check (priority in ('must', 'should', 'could')),
  energy_demand      text not null check (energy_demand in ('high', 'medium', 'low')),
  estimated_minutes  int not null check (estimated_minutes > 0),
  status             text not null default 'todo' check (status in ('todo', 'scheduled', 'done'))
);

alter table task enable row level security;
create policy "task: owner read/write" on task
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Day plan + blocks (PlannerService output) ───────────────────────────

create table day_plan (
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  coach_note    text not null,
  generated_at  timestamptz not null,
  primary key (user_id, date)
);

alter table day_plan enable row level security;
create policy "day_plan: owner read/write" on day_plan
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table plan_block (
  -- text, not uuid: PlannerService assigns its own ids ("block-1", "block-2",
  -- ...) starting fresh for every plan, so they're only unique within one
  -- user's day, not globally — hence the composite primary key below.
  id            text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  start_time    text not null check (start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time      text not null check (end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  type          text not null check (type in ('focus', 'light', 'break', 'meal', 'recovery')),
  title         text not null,
  task_id       uuid references task(id) on delete set null,
  energy_level  text not null check (energy_level in ('low', 'moderate', 'high')),
  rationale     text not null,
  primary key (user_id, date, id)
);

alter table plan_block enable row level security;
create policy "plan_block: owner read/write" on plan_block
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
