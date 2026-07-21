# Ingredient recognition spike report

Date: 2026-07-21

Issue: #23

Status: production vision remains disabled pending valid full benchmark results

## Scope

Recognition is presence-only. The model reports that an ingredient is visible;
it does not estimate quantity, unit, weight, grams, expiry, stock count, or the
contents of opaque containers. Every candidate is provisional: the user must be
able to add, edit, delete, and explicitly confirm ingredients before inventory
is changed.

The shared contract distinguishes:

- `ok`: one or more visible ingredient candidates
- `empty`: no visible food or an unrecognizable image, with no ingredients
- `refused`: policy refusal, with no ingredients

## Capability verification

| Provider | Default model | Official finding | Spike behavior |
| --- | --- | --- | --- |
| Xiaomi MiMo domestic | `mimo-v2.5` | native image/audio/video/text understanding; OpenAI-compatible image input and JSON object response mode | enabled for benchmark; final output is revalidated by shared Zod schema |
| OpenAI | `gpt-5.6-luna` | image input and structured outputs | enabled for benchmark |
| Gemini | `gemini-3.1-flash-lite` | image input and structured outputs | enabled for benchmark |
| MiniMax domestic | `MiniMax-M2.7` | official AI SDK compatibility table marks image/file inputs unsupported | hard-blocked before network; text-only nutrition candidate |

Sources:

- [MiMo OpenAI Chat Completions compatibility](https://mimo.mi.com/docs/zh-CN/api/chat/openai-api)
- [MiMo V2.5 capability and pricing](https://mimo.mi.com/docs/zh-CN/usage-guide/multimodal-understanding/image-understanding)
- [OpenAI gpt-5.6-luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [MiniMax domestic AI SDK compatibility](https://platform.minimaxi.com/docs/api-reference/text-ai-sdk)

## Evaluation set

`scripts/vision-eval/manifest.json` contains exactly 20 authorized Wikimedia
Commons cases: full refrigerators, multi-ingredient shelves, occluded/blurry
scenes, single ingredients, and no-food images. Source URL, author, license,
scene, and human truth are recorded. Original images are not redistributed.

Metrics are exact/alias name matching plus category comparison:

- schema success, precision, recall, F1, category accuracy, hallucination rate
- human additions (false negatives), edits (category corrections), and deletions
  (false positives)
- p50/p95 provider latency and token-derived cost per image

## Live result status

A one-image connectivity smoke test was attempted for the previously configured
OpenAI and Gemini environments. OpenAI returned HTTP 401 and Gemini returned
HTTP 403, so neither credential was valid for an authorized evaluation. No
quality or admission metric is inferred from those failures.

The MiMo credential supplied during planning was disclosed in a conversation and
was therefore treated as compromised: it was not stored, logged, or called. A
rotated credential must be installed locally as `MIMO_API_KEY` before the full
20-image benchmark. MiniMax was not called because M2.7 has no image-input
capability.

Consequently there is no valid complete live report yet. Production recognition
must remain behind a disabled feature flag, with manual ingredient entry as the
only release path. When fresh credentials are available, run each provider
explicitly and attach the generated reports to #23; do not run providers in
parallel against user photos.

## Current pricing assumptions

The harness uses current public pay-as-you-go rates and records configured model
names in every report. MiMo V2.5 defaults to $0.14/MTok cache-miss input and
$0.28/MTok output. Rates are environment-overridable so a benchmark can lock the
price effective on its run date. Cost is computed from provider usage, not image
size estimates.
