# Akeso

**Your Personal Energy Coach**

Akeso helps people understand their daily energy and plan important work for the hours when they are at their best.

> Hackathon project for the ICON UNSW × Lyra Hackathon 2026.

## Repository layout

```
apps/
  app/          # Expo Router app (iOS / Android / Web)
  api/          # Express API — implements every endpoint in API_CONTRACT.md
packages/
  domain/       # Shared contract: types, Zod schemas, EnergyEngine, PlannerService, fixtures
docs/
  API_CONTRACT.md   # Frozen v1 API contract (Issue #6)
  ARCHITECTURE / TEAM_CONTRACT
```

## Getting started

```bash
npm install          # from repo root (npm workspaces)
npm run app:web      # Expo dev server in the browser
npm run app          # Expo dev server (scan QR with Expo Go for mobile)
npm run api          # Express API dev server on http://localhost:3001
npm run typecheck    # typecheck app + domain + api
npm run test         # domain (schemas, EnergyEngine, PlannerService) + API route tests
npm run test --workspace=apps/app  # Expo component and interaction tests
```

Copy `apps/api/.env.example` to `apps/api/.env` before running `npm run api`.
The API refuses to start unless you explicitly pick a mode — there's no
silent default. With `DEMO_MODE=true` (already set in `.env.example`) every
request is attributed to one fixed demo user, backed by in-memory repos —
nothing to configure, nothing persists across restarts, and `DEMO_MODE=true`
is itself refused when `NODE_ENV=production`. Set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` instead (and leave `DEMO_MODE` unset) to persist
for real; see [apps/api/supabase/migrations](apps/api/supabase/migrations)
for the schema and [apps/api/supabase/seed.sql](apps/api/supabase/seed.sql) for demo data
matching the shared fixtures.

```bash
curl http://localhost:3001/health
# {"success":true,"data":{"status":"ok","version":"0.1.0","uptimeSeconds":3}}

curl -X POST http://localhost:3001/v1/checkins -H 'Content-Type: application/json' -d '{
  "date":"2026-07-21","sleepHours":7.5,"sleepQuality":4,"mood":4,"stress":4,"energyNow":3,"caffeine":"afternoon"
}'
# {"success":true,"data":{"date":"2026-07-21","score":61,"band":"moderate", ...}}

curl http://localhost:3001/v1/plan/2026-07-21
# the same check-in, now with a generated day plan
```

The app currently runs entirely on `FixtureService` (no backend needed). The
swap point for the real API is `apps/app/src/services/index.ts` — see
`docs/API_CONTRACT.md` for the frozen contract the backend implements.

## Core flow

Welcome / Onboarding → 20-second Daily Check-in → Energy Score dashboard
(factors + day curve) → energy-aware Today's Plan → nutrition matched to
today's needs and your fridge.

Akeso is an energy coach, not a medical device.
