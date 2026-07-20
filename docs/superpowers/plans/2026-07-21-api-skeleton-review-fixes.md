# API Skeleton Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR #10's Express scaffold load local configuration, avoid import-time server side effects, and run meaningful tests without misleading scripts or metadata.

**Architecture:** Keep `index.ts` as the process entrypoint and move Express assembly into `app.ts`. Load the API-local `.env` from `env.ts`, keep response envelopes unchanged, and exercise the app through Supertest without binding a persistent port.

**Tech Stack:** Node.js 22, TypeScript 6, Express 5, Vitest 4, Supertest, npm workspaces.

## Global Constraints

- Do not add business routes, Supabase, authentication, or schemas.
- Preserve the existing success/error envelope and error codes.
- Use tests before production behavior changes.
- The delivery PR must target `feat/api-skeleton`.

---

### Task 1: Make environment loading explicit

**Files:**
- Test: `apps/api/src/env.test.ts`
- Modify: `apps/api/src/env.ts`

**Interfaces:**
- Produces: `parsePort(raw: string | undefined): number`
- Produces: startup configuration `env.port`

- [ ] **Step 1: Write failing tests for port parsing and `.env` loading**

Test valid/default/invalid ports and use a temporary API `.env` plus a fresh
module import to demonstrate that the current implementation ignores the file.

- [ ] **Step 2: Run the environment test and verify the `.env` assertion fails**

Run: `npx vitest run apps/api/src/env.test.ts`
Expected: FAIL because `env.port` remains `3001` instead of the file value.

- [ ] **Step 3: Load the API-local file before parsing**

Use Node's built-in `loadEnvFile` only when
`new URL('../.env', import.meta.url)` exists, then export `parsePort` for direct
edge-case tests.

- [ ] **Step 4: Run the environment test and verify it passes**

Run: `npx vitest run apps/api/src/env.test.ts`
Expected: all environment tests PASS.

### Task 2: Separate app assembly and cover HTTP behavior

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/middleware/error.ts`
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `createApp(): Express`
- Consumes: existing `healthRouter`, `notFoundHandler`, and `errorHandler`

- [ ] **Step 1: Install test-only HTTP dependencies**

Run: `npm install --save-dev --workspace=apps/api supertest @types/supertest`
Expected: API package and lockfile contain the two test dependencies.

- [ ] **Step 2: Write the API behavior test against `./app`**

Cover `GET /health`, an unknown route, and malformed JSON. Importing `./app`
must not start a listener.

- [ ] **Step 3: Run the API test and verify the missing module failure**

Run: `npx vitest run apps/api/src/app.test.ts`
Expected: FAIL because `apps/api/src/app.ts` does not exist.

- [ ] **Step 4: Move `createApp()` into `app.ts` and keep startup in `index.ts`**

`app.ts` creates Express, installs JSON parsing, the health router, not-found
handling, and error handling. `index.ts` imports `createApp`, reads `env.port`,
and calls `listen`. Rename unused error-handler parameters to `_req` and
`_next` without changing the required four-argument signature.

- [ ] **Step 5: Run both focused suites**

Run: `npx vitest run apps/api/src/env.test.ts apps/api/src/app.test.ts`
Expected: both suites PASS with 200, 400, and 404 assertions satisfied.

### Task 3: Remove misleading and duplicated configuration

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/routes/health.ts`
- Modify: `apps/api/tsconfig.json`
- Modify: `README.md`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `apps/api/package.json` version through JSON module resolution
- Produces: root `test` and workspace-discovered `typecheck` scripts

- [ ] **Step 1: Make tests and typechecks truthful**

Change root scripts to `vitest run` and
`npm run typecheck --workspaces --if-present`; remove the fake `lint` alias.
Remove the API package's unused `main` field.

- [ ] **Step 2: Use the API package version and completed uptime seconds**

Enable `resolveJsonModule`, import `../../package.json` in `health.ts`, return
its `version`, and replace `Math.round` with `Math.floor`.

- [ ] **Step 3: Update README commands**

Describe real tests and remove the fake lint command while keeping the API
`.env` setup instructions.

- [ ] **Step 4: Run full validation**

Run: `npm test && npm run typecheck && git diff --check`
Expected: all tests PASS, every workspace typechecks, and the diff is clean.

- [ ] **Step 5: Verify runtime `.env` behavior**

Create an ignored `apps/api/.env` containing an unused local port, run
`npm run api`, and confirm the startup log uses that port; then stop the server.

### Task 4: Publish the stacked fix PR

**Files:**
- Review all intended changed files before staging.

**Interfaces:**
- Produces: pushed branch `codex/fix-api-skeleton-review`
- Produces: draft PR based on `feat/api-skeleton`

- [ ] **Step 1: Inspect and stage only the planned files**

Run: `git status -sb` and `git diff --stat`, then explicitly `git add` the
design, plan, API source/tests/config, root scripts, README, and lockfile.

- [ ] **Step 2: Commit the implementation**

Run: `git commit -m "fix: harden API skeleton"`
Expected: one implementation commit after the design/plan commits.

- [ ] **Step 3: Push the branch**

Run: `git push -u origin codex/fix-api-skeleton-review`
Expected: the remote tracking branch is created.

- [ ] **Step 4: Open a draft PR targeting the original PR branch**

Run: `gh pr create --draft --base feat/api-skeleton --head codex/fix-api-skeleton-review --title "fix: harden API skeleton" --body-file <file>`
Expected: a GitHub PR URL whose base is `feat/api-skeleton`.
