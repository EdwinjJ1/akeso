-- Inventory/energy/profile/provider-specific nutrition plan cache (Issue #24).
-- The cache key is computed server-side and includes the sorted confirmed
-- inventory plus the provider, model and prompt version. Photos are never
-- stored here; only schema-validated NutritionPlan JSON is persisted.

create table nutrition_plan_cache (
  user_id     uuid not null references auth.users(id) on delete cascade,
  cache_key   text not null,
  date        date not null,
  plan        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, cache_key)
);

create index nutrition_plan_cache_user_date_idx
  on nutrition_plan_cache (user_id, date);

alter table nutrition_plan_cache enable row level security;
create policy "nutrition_plan_cache: owner read/write" on nutrition_plan_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
