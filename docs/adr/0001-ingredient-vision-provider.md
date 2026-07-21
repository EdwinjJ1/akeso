# ADR 0001: Gate fridge recognition behind an explicit vision provider

- Status: Accepted for spike; production rollout deferred
- Date: 2026-07-21
- Issues: #23, #24, #34

## Context

Akeso needs to turn a fridge photo into editable ingredient candidates. The
product only needs presence, not quantity or grams. A provider can hallucinate,
refuse, return malformed data, or disclose a user's home image to a third party,
so capability claims alone are insufficient for production selection.

## Decision

Keep production photo recognition disabled until one provider passes the full
20-image admission suite. Manual ingredient CRUD is the release-safe fallback.

The first live candidate is Xiaomi MiMo `mimo-v2.5` through the domestic API.
OpenAI `gpt-5.6-luna` and Gemini `gemini-3.1-flash-lite` are alternatives.
MiniMax `MiniMax-M2.7` is excluded from vision because its official domestic
compatibility documentation says image input is unsupported; it may later be
evaluated independently for text-only nutrition suggestions. Retired MiMo V2
model names are not accepted.

Business code will eventually depend only on
`recognizeIngredients(input): Promise<IngredientRecognitionResult>` (#34). A
production call sends the image to exactly one explicitly configured provider.
No fallback chain may resend a user image to another supplier. Cross-provider
parallelism is restricted to this authorized public evaluation set.

## Contract and human confirmation

All vendor output is parsed and revalidated with the shared strict Zod schema.
Malformed data is an error, not an empty fridge. `empty` and `refused` are
explicit non-ingredient results. Candidates contain only name, standard category,
confidence, and nullable uncertainty reason. Quantity, unit, grams, expiry, and
opaque-container guesses are forbidden.

Recognition never writes inventory. The #24 confirmation UI must start every
candidate unconfirmed and let the user add, edit, delete, and selectively confirm
items. Only the final confirmed set is persisted.

## Privacy and security

- API keys are server-only environment values and are never included in app
  bundles, Git, reports, URLs, logs, or error messages.
- A key pasted into a ticket, PR, chat, or log is compromised and must be revoked;
  it is never reused for a test.
- User photos are processed in memory, limited to 5 MiB, signature-checked as
  JPEG/PNG/WebP, and never written to Supabase, disk, analytics, or application
  logs.
- The client will re-encode a maximum 1600 px JPEG to remove metadata before
  upload (#24).
- Provider privacy/retention terms must be reviewed before its feature flag is
  enabled in a deployment region. User-facing disclosure must identify that a
  third-party model processes the image.

## Reliability and cost

Each attempt has a 15-second timeout. Only HTTP 429 and 5xx are retried, exactly
once. Authentication, refusal, malformed output, and other 4xx errors are not
retried. The provider/model, prompt version, latency, usage, and cost may be
logged, but never the image, key, raw response, or user ingredient names.

The admission gates are 100% schema success, at least 85% precision, at least
75% recall, at most 10% hallucination, and p95 latency at most 15 seconds. Costs
are recorded from provider usage and the price effective at benchmark time.

## Feature flag and rollback

`VISION_RECOGNITION_ENABLED` defaults to false. Enabling also requires an
explicit `VISION_PROVIDER`, model, and server key. Missing configuration returns
an unavailable result so the UI continues with manual entry. Rollback is to
disable the flag; no migration or image cleanup is required because photos are
not persisted.

## Consequences

The product can ship manual presence-only inventory before vision is admitted.
Adding or replacing a provider does not change domain contracts or inventory.
There is intentionally no automatic high-availability failover for photos,
because avoiding undisclosed cross-provider transmission takes precedence.
