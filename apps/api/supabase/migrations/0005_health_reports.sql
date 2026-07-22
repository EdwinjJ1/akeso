-- Health-report uploads and safe recommendations MVP.
--
-- Only schema-validated data is stored: a report holds the metrics the user
-- reviewed and confirmed (as jsonb matching ReportMetric[]), never the
-- uploaded image or any raw report text. Recommendations are cached per
-- report + provider/model/prompt version. Both tables are row-level-secured
-- so a user only ever sees their own reports. Table shapes match
-- apps/api/src/repos/supabase.ts exactly.

-- ── Confirmed reports ────────────────────────────────────────────────────

create table health_report (
  -- text, not uuid: the API assigns the id (randomUUID) and upserts by it,
  -- same caller-assigned-id pattern as fridge_item / plan_block.
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- ReportMetric[]: { id, name, value, unit, referenceLow, referenceHigh, status }.
  -- Status is recomputed server-side from the report's own bounds on write.
  metrics     jsonb not null,
  primary key (user_id, id)
);

create index health_report_user_created_idx
  on health_report (user_id, created_at desc);

alter table health_report enable row level security;
create policy "health_report: owner read/write" on health_report
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Recommendation cache ─────────────────────────────────────────────────

create table report_recommendation_cache (
  user_id          uuid not null references auth.users(id) on delete cascade,
  cache_key        text not null,
  report_id        text not null,
  -- HealthRecommendationSet JSON. Every recommendation cites only confirmed
  -- metric ids; the set is schema-validated before it is written here.
  recommendations  jsonb not null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, cache_key),
  -- Cached recommendations are derived from a specific report. When that report
  -- is deleted, its cache rows must go too — never leave orphaned health data.
  -- The app also deletes them explicitly (repos.reportRecommendationCache
  -- .removeByReport); this cascade covers any out-of-band delete of the report.
  constraint report_recommendation_cache_report_fk
    foreign key (user_id, report_id)
    references health_report (user_id, id)
    on delete cascade
);

create index report_recommendation_cache_user_report_idx
  on report_recommendation_cache (user_id, report_id);

alter table report_recommendation_cache enable row level security;
create policy "report_recommendation_cache: owner read/write" on report_recommendation_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
