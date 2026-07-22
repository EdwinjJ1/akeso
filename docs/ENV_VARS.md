# Environment variable inventory

Generated for #60 (sync and verify production environment variables on
Vercel). Two separate Vercel projects are involved:

- **`akeso`** — static Expo web export (`apps/app`), root `vercel.json`,
  build command `npm run app:export`. Only ever sees `EXPO_PUBLIC_*` vars,
  which Expo inlines into the client bundle at build time.
- **`akeso-api`** — the Express API (`apps/api`), deployed as a Vercel
  Function. Root Directory must be set to `apps/api` with "Include files
  outside of the Root Directory" enabled, since it depends on the npm
  workspace root (`packages/domain`, `packages/contracts`).

`apps/api` has no client exposure risk by construction: none of its
variables are `EXPO_PUBLIC_*`, so nothing here can leak into the app bundle
by accident.

## `akeso` (apps/app) — client-exposed, build-time only

| Variable | Owner | Purpose | Exposure | Preview | Production | Required |
|---|---|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | API & Data | Base URL the app calls for `apps/api`. Must be a real deployed URL — never `localhost`, per `docs/RELEASE.md`. | Public (client bundle) | Yes | Yes | Yes — app throws at startup if unset (`apps/app/src/services/index.ts`) |
| `EXPO_PUBLIC_SUPABASE_URL` | API & Data | Supabase project URL for anonymous sign-in / auth. | Public (client bundle) | Yes | Yes | Yes — required alongside the anon key |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | API & Data | Supabase publishable (`sb_publishable_…`) key. Public by design — never the service role key. | Public (client bundle) | Yes | Yes | Yes |

No `DEMO_MODE` / fixture fallback exists in the client build path anymore —
`fixture-service.ts` was removed; a missing required var fails the build/boot
instead of silently degrading.

## `akeso-api` (apps/api) — server-only

| Variable | Owner | Purpose | Exposure | Preview | Production | Required |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | API & Data | Supabase project URL, server-side client. | Server-only | Yes | Yes | Yes — `env.ts` throws at import time outside tests if missing |
| `SUPABASE_SERVICE_ROLE_KEY` | API & Data | Supabase service-role key; bypasses RLS. **Never** goes to `apps/app`. | Server-only, secret | Yes | Yes | Yes |
| `PORT` | API & Data | Local listen port. Unused on Vercel (function runtime owns the port). | Server-only | No | No | No (local dev only) |
| `CORS_ORIGINS` | API & Data | Comma-separated allow-list of browser origins. Must include the deployed web app's exact origin (`https://akeso-navy.vercel.app`), not just localhost. | Server-only | Yes | Yes | No (defaults to localhost ports — deployments must override) |
| `MEMORY_REPO_LIMIT` | API & Data | Cap on in-memory test repos. | Server-only | No | No | No (has default) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `RATE_LIMIT_WRITE_MAX` | API & Data | Per-user request throttling. | Server-only | Optional | Optional | No (has defaults) |
| `VISION_FEATURE_ENABLED` | Domain & AI | Feature flag for fridge/report image recognition. | Server-only | Optional | Optional | No (defaults true) |
| `VISION_PROVIDER` | Domain & AI | Selects exactly one vision provider (`mimo` or `gemini`) per request — never both. | Server-only | Yes | Yes | Effectively required once vision is enabled |
| `MIMO_API_KEY` / `MIMO_VISION_MODEL` | Domain & AI | Mimo vision provider credentials/model. | Server-only, secret | Only if `VISION_PROVIDER=mimo` | Only if `VISION_PROVIDER=mimo` | Conditional |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) / `GEMINI_VISION_MODEL` | Domain & AI | Gemini vision + report/plan generation credentials. | Server-only, secret | Only if `VISION_PROVIDER=gemini` | Only if `VISION_PROVIDER=gemini` | Conditional |

### Known gap: `CORS_ORIGINS` and Preview

`cors` origin matching in `apps/api/src/app.ts` is an exact-string
allow-list (`env.corsOrigins`), not a wildcard. Vercel Preview deployments
of `akeso` get a unique URL per deployment
(`akeso-<hash>-<team>.vercel.app`), so a fixed `CORS_ORIGINS` value cannot
cover every future preview URL for the web app. Current Preview value
covers the known production origin plus local dev ports only. If
Preview-to-Preview (web preview calling API preview) smoke testing is
required, `CORS_ORIGINS` needs to be updated per deployment or the API
needs a pattern-based origin check (e.g. matching `*.vercel.app` for this
project only) — out of scope for this sync and left for a follow-up.

### Known gap: leaked `GEMINI_API_KEY`

The `GEMINI_API_KEY` currently synced to `akeso-api` was already flagged by
Google as leaked (403 "reported as leaked") prior to this sync. It was
synced as-is per explicit instruction so the variable wiring is complete
end-to-end, but report/plan generation and Gemini-based vision recognition
will fail with 403s until the key is rotated at
https://aistudio.google.com and re-synced with `vercel env add
GEMINI_API_KEY <env> --sensitive`.

## Verification checklist (per acceptance criteria)

- [x] Full variable inventory generated from code (`apps/api/src/env.ts`,
      `apps/app/src/services/index.ts`, `apps/app/src/services/supabase-client.ts`)
      and docs (`apps/api/.env.example`, `apps/app/.env.example`,
      `docs/RELEASE.md`).
- [x] `EXPO_PUBLIC_*` vars contain only public-safe values (Supabase
      publishable key, not service role; API URL is a public endpoint).
- [x] Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) exist only on
      the server-side `akeso-api` project, never on `akeso`.
- [ ] `akeso-api` Preview/Production both configured — **blocked**: Root
      Directory must be set to `apps/api` in the Vercel dashboard before a
      working deploy exists to point `EXPO_PUBLIC_API_URL` at. Env vars are
      set; the deploy itself is pending.
- [ ] `EXPO_PUBLIC_API_URL` synced — pending the `akeso-api` deploy above.
- [ ] Smoke tests (web home, API health, Supabase Auth, protected API,
      report parsing) on both Preview and Production — pending the deploy
      above.
- [x] No service role key, AI key, or other secret appears in this
      document, build output above, or shell history captured in this
      session (values were piped via `--value`/stdin to `vercel env add`,
      never echoed).
