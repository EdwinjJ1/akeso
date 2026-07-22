-- Fridge items + reminder preferences (Issue #17).
--
-- Neither has a consuming UI yet (Nutrition's fridge list is still the
-- read-only fixture view; reminders don't exist as a screen at all) — these
-- tables persist ahead of that work so the data layer isn't a blocker.
-- Table shapes match apps/api/src/repos/supabase.ts exactly.

-- ── Fridge items ─────────────────────────────────────────────────────────

create table fridge_item (
  -- text, not uuid: PUT /v1/fridge/:id upserts by a caller-supplied id, and
  -- there is no client yet to dictate whether that id is a uuid — same
  -- pattern as plan_block's caller-assigned id.
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  category    text not null check (
    category in ('protein', 'vegetable', 'fruit', 'dairy', 'grain', 'other')
  ),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

alter table fridge_item enable row level security;
create policy "fridge_item: owner read/write" on fridge_item
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Reminder preferences ─────────────────────────────────────────────────

create table reminder_preference (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  enabled        boolean not null,
  check_in_time  text not null check (check_in_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  updated_at     timestamptz not null default now()
);

alter table reminder_preference enable row level security;
create policy "reminder_preference: owner read/write" on reminder_preference
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
