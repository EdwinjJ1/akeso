-- Preserve user edits made through PATCH /v1/plan/:date/blocks/:blockId.
-- Existing generated blocks retain the defaults and require no backfill.

alter table plan_block
  add column status text not null default 'planned'
    check (status in ('planned', 'completed')),
  add column source text not null default 'akeso'
    check (source in ('akeso', 'user')),
  add column original_title text,
  add column original_start_time text
    check (
      original_start_time is null
      or original_start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
    ),
  add column original_end_time text
    check (
      original_end_time is null
      or original_end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
    ),
  add constraint plan_block_original_suggestion_matches_source check (
    (
      source = 'akeso'
      and original_title is null
      and original_start_time is null
      and original_end_time is null
    )
    or
    (
      source = 'user'
      and original_title is not null
      and original_start_time is not null
      and original_end_time is not null
      and original_end_time > original_start_time
    )
  );
