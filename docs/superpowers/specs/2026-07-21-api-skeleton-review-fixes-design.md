# API Skeleton Review Fixes

## Goal

Make PR #10's Express scaffold truthful, testable, and minimal before it is
merged, without adding business endpoints or changing the frozen API contract.

## Scope

- Load `apps/api/.env` before validating `PORT`, while preserving the current
  `3001` default and fail-fast validation.
- Separate application construction from process startup so tests can import
  the Express app without opening a network port.
- Add focused tests for the health response, not-found envelope, malformed JSON
  handling, and port parsing.
- Keep Vitest only because the PR will contain real tests; remove
  `--passWithNoTests` so an empty suite cannot pass CI.
- Remove the misleading root `lint` alias and make root typechecking discover
  workspace `typecheck` scripts rather than naming every workspace manually.
- Remove unused API package metadata and derive the health version from one
  explicit source instead of maintaining a second hard-coded constant.
- Report elapsed uptime with `Math.floor` so it counts completed seconds.

## Structure

- `apps/api/src/app.ts` owns `createApp()` and middleware/router assembly.
- `apps/api/src/index.ts` loads configuration, constructs the app, and listens.
- `apps/api/src/env.ts` exposes a testable `parsePort()` and the validated
  runtime configuration.
- API tests import `createApp()` from `app.ts`; they do not start a real server.

## Error Handling

The existing success/error envelope and error codes remain unchanged. Tests
cover the current 200, 400, and 404 behavior. Express's four-argument error
middleware signature stays intact, with unused parameters named explicitly.

## Validation

- Demonstrate each behavior-changing test failing before its implementation.
- Run the complete test suite and root typecheck.
- Start the API with a temporary `.env` port and verify the configured port is
  used.
- Run `git diff --check` before publishing.

## Delivery

Commit the implementation on `codex/fix-api-skeleton-review`, push it to
`EdwinjJ1/akeso`, and open a draft pull request whose base is
`feat/api-skeleton`. Merging that draft will update the original PR #10.

## Non-goals

- No Supabase integration, authentication, Zod schemas, or business routes.
- No general linting stack or unrelated mobile-app dependency changes.
