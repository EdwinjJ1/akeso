-- Demo data for a fresh Supabase project — mirrors packages/domain/src/fixtures.ts
-- exactly, so GET /v1/energy/2026-07-21 and GET /v1/plan/2026-07-21 return the
-- same numbers the App's FixtureService already shows.
--
-- Prerequisite: create the demo auth user first (Supabase Studio →
-- Authentication → Add user, or supabase.auth.admin.createUser({...})),
-- then replace every '00000000-0000-0000-0000-000000000001' below with
-- that user's real id.
--
-- To clean up: delete the rows below by that same user_id, e.g.
--   delete from plan_block   where user_id = '<demo-user-id>';
--   delete from day_plan     where user_id = '<demo-user-id>';
--   delete from task         where user_id = '<demo-user-id>';
--   delete from energy_result where user_id = '<demo-user-id>';
--   delete from checkin      where user_id = '<demo-user-id>';
--   delete from user_profile where user_id = '<demo-user-id>';

insert into user_profile (user_id, display_name, goal, typical_wake, typical_sleep, dietary_preference)
values ('00000000-0000-0000-0000-000000000001', 'Alex', 'academic', '07:30', '23:30', 'none');

insert into checkin (user_id, date, sleep_hours, sleep_quality, mood, stress, energy_now, caffeine, notes)
values ('00000000-0000-0000-0000-000000000001', '2026-07-21', 7.5, 4, 4, 4, 3, 'afternoon', null);

insert into energy_result (user_id, date, score, band, headline, factors, curve, peak_window, dip_window, computed_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '2026-07-21',
  72,
  'high',
  'Solid morning ahead — protect 9:00–11:30 for deep work.',
  '[
    {"key":"sleep_duration","label":"7.5h sleep","impact":14,"explanation":"Close to your 8h target — your biggest energy source today."},
    {"key":"sleep_quality","label":"Good sleep quality","impact":6,"explanation":"You rated sleep 4/5, which lifts your morning peak."},
    {"key":"mood","label":"Positive mood","impact":5,"explanation":"Mood 4/5 usually adds steady energy across the day."},
    {"key":"stress","label":"Elevated stress","impact":-8,"explanation":"Stress 4/5 tends to deepen your afternoon dip."},
    {"key":"caffeine","label":"Afternoon coffee","impact":-3,"explanation":"Caffeine after 2pm can push tonight’s sleep later."}
  ]'::jsonb,
  '[
    {"hour":6,"level":35}, {"hour":7,"level":48}, {"hour":8,"level":62}, {"hour":9,"level":78},
    {"hour":10,"level":84}, {"hour":11,"level":80}, {"hour":12,"level":68}, {"hour":13,"level":55},
    {"hour":14,"level":44}, {"hour":15,"level":40}, {"hour":16,"level":50}, {"hour":17,"level":60},
    {"hour":18,"level":64}, {"hour":19,"level":58}, {"hour":20,"level":50}, {"hour":21,"level":40},
    {"hour":22,"level":30}
  ]'::jsonb,
  '{"startHour":9,"endHour":12}'::jsonb,
  '{"startHour":14,"endHour":16}'::jsonb,
  '2026-07-21T08:05:00+10:00'
);

insert into task (id, user_id, date, title, priority, energy_demand, estimated_minutes, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2026-07-21', 'COMP2521 assignment — graph section', 'must', 'high', 120, 'scheduled'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2026-07-21', 'Internship cover letter draft', 'must', 'high', 60, 'scheduled'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '2026-07-21', 'Reply to tutor + admin emails', 'should', 'low', 30, 'scheduled'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '2026-07-21', 'Gym — light session', 'should', 'medium', 60, 'scheduled'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '2026-07-21', 'Review lecture notes (week 8)', 'could', 'medium', 45, 'todo');

insert into day_plan (user_id, date, coach_note, generated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '2026-07-21',
  'Today is front-loaded on purpose: your two hardest tasks sit inside the 9:00–11:30 peak, and the 2–4pm dip only carries admin and recovery.',
  '2026-07-21T08:05:10+10:00'
);

insert into plan_block (id, user_id, date, start_time, end_time, type, title, task_id, energy_level, rationale)
values
  ('block-1', '00000000-0000-0000-0000-000000000001', '2026-07-21', '08:00', '08:45', 'meal', 'Breakfast + slow start', null, 'moderate', 'Energy is still climbing — ease in before the peak.'),
  ('block-2', '00000000-0000-0000-0000-000000000001', '2026-07-21', '09:00', '11:00', 'focus', 'COMP2521 assignment — graph section', '10000000-0000-0000-0000-000000000001', 'high', 'Your hardest task lands in today’s 9–11:30 peak.'),
  ('block-3', '00000000-0000-0000-0000-000000000001', '2026-07-21', '11:00', '11:15', 'break', 'Walk + water', null, 'high', 'Short movement break keeps the peak going.'),
  ('block-4', '00000000-0000-0000-0000-000000000001', '2026-07-21', '11:15', '12:15', 'focus', 'Internship cover letter draft', '10000000-0000-0000-0000-000000000002', 'high', 'Second demanding task while energy is still above 70.'),
  ('block-5', '00000000-0000-0000-0000-000000000001', '2026-07-21', '12:15', '13:00', 'meal', 'Lunch — protein + iron focus', null, 'moderate', 'A heavy-carb lunch would deepen your 2–4pm dip.'),
  ('block-6', '00000000-0000-0000-0000-000000000001', '2026-07-21', '14:00', '14:30', 'light', 'Emails + admin', '10000000-0000-0000-0000-000000000003', 'low', 'Low-energy window — save it for low-demand work.'),
  ('block-7', '00000000-0000-0000-0000-000000000001', '2026-07-21', '14:30', '15:00', 'recovery', 'Recovery break — no screens', null, 'low', 'Stress is 4/5 today; a real break blunts the dip.'),
  ('block-8', '00000000-0000-0000-0000-000000000001', '2026-07-21', '17:00', '18:00', 'focus', 'Gym — light session', '10000000-0000-0000-0000-000000000004', 'moderate', 'Your evening rebound window suits movement.');
