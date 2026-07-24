-- User-adjustable energy score + "Tell Akeso more" context notes.
--
-- 1. `energy_result.adjustment` — nullable jsonb matching ScoreAdjustment
--    ({ originalScore, adjustedScore, note?, adjustedAt }). Present only
--    after the user manually corrects the day's score; the row's score/band/
--    curve/windows are already re-derived from the adjusted value on write,
--    so readers never merge anything. A fresh check-in upsert overwrites the
--    whole row and clears the adjustment by design.
-- 2. `context_note` — free-text follow-ups the user (or the coach's own
--    follow-up questions, author 'coach') adds for a given day. Fed into the
--    AI coach context so it can act on mood, symptoms, food details, etc.
-- Table shapes match apps/api/src/repos/supabase.ts exactly.

-- ── Score adjustment ─────────────────────────────────────────────────────

alter table energy_result add column adjustment jsonb;

-- ── Context notes ────────────────────────────────────────────────────────

create table context_note (
  -- text, not uuid: the API assigns the id (randomUUID), same
  -- caller-assigned-id pattern as fridge_item / health_report.
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  author      text not null check (author in ('user', 'coach')),
  text        text not null check (char_length(text) between 1 and 500),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index context_note_user_date_idx
  on context_note (user_id, date, created_at);

alter table context_note enable row level security;
create policy "context_note: owner read/write" on context_note
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
