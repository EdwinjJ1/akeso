# Akeso

**Your Personal Energy Coach**

Akeso helps people understand their daily energy and plan important work for the hours when they are at their best.

> Hackathon project for the ICON UNSW × Lyra Hackathon 2026.

## Repository layout

```
apps/
  app/          # Expo Router app (iOS / Android / Web)
  api/          # Express API skeleton (health check only for now — Issue #3 adds endpoints)
packages/
  domain/       # Shared contract: types, AkesoService interface, demo fixtures
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
npm run test         # API health, error-envelope, and environment tests
```

Copy `apps/api/.env.example` to `apps/api/.env` before running `npm run api`
(defaults are fine for local dev — no secrets required yet).

```bash
curl http://localhost:3001/health
# {"success":true,"data":{"status":"ok","version":"0.1.0","uptimeSeconds":3}}
```

The app currently runs entirely on `FixtureService` (no backend needed). The
swap point for the real API is `apps/app/src/services/index.ts` — see
`docs/API_CONTRACT.md` for the frozen contract the backend must implement.

## Core flow

Welcome / Onboarding → 20-second Daily Check-in → Energy Score dashboard
(factors + day curve) → energy-aware Today's Plan → nutrition matched to
today's needs and your fridge.

Akeso is an energy coach, not a medical device.
