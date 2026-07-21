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

insert into checkin (user_id, date, reported_energy, sleep_duration, last_meal_timing, last_meal_description, hydration)
values ('00000000-0000-0000-0000-000000000001', '2026-07-21', 4, '7_8h', '1_3h', null, '1_1_5l');

insert into energy_result (user_id, date, score, band, headline, factors, curve, peak_window, dip_window, computed_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '2026-07-21',
  80,
  'high',
  'Strong day ahead — protect 10:00–12:00 for demanding work.',
  '[
    {"key":"reported_energy","label":"Feeling good (4/5)","role":"reported_energy","impact":20,"explanation":"You reported your energy as 4/5 — that lifts today’s baseline by 20."},
    {"key":"sleep_duration","label":"7–8h sleep","role":"possible_context","explanation":"Around a solid night — a likely support for today."},
    {"key":"last_meal","label":"Ate 1–3h ago","role":"possible_context","explanation":"Recent enough that fuel probably isn’t dragging you."},
    {"key":"hydration","label":"1–1.5L water","role":"possible_context","explanation":"Making progress — keep sipping through the day."}
  ]'::jsonb,
  '[
    {"hour":7,"level":49}, {"hour":9,"level":85}, {"hour":11,"level":91}, {"hour":13,"level":78},
    {"hour":15,"level":63}, {"hour":17,"level":73}, {"hour":19,"level":70}, {"hour":21,"level":55}
  ]'::jsonb,
  '{"startHour":10,"endHour":12}'::jsonb,
  '{"startHour":14,"endHour":16}'::jsonb,
  '2026-07-21T00:00:00.000Z'
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
  'Today is front-loaded on purpose: your two hardest tasks sit near the late-morning peak, and the afternoon dip only carries admin and recovery.',
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
  ('block-7', '00000000-0000-0000-0000-000000000001', '2026-07-21', '14:30', '15:00', 'recovery', 'Recovery break — no screens', null, 'low', 'Use the dip window for a low-pressure reset.'),
  ('block-8', '00000000-0000-0000-0000-000000000001', '2026-07-21', '17:00', '18:00', 'focus', 'Gym — light session', '10000000-0000-0000-0000-000000000004', 'moderate', 'Your evening rebound window suits movement.');
