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

Metrics use normalized exact/alias matching, including basic English
singular/plural equivalence, plus category comparison:

- schema success, precision, recall, F1, category accuracy, hallucination rate
- human additions (false negatives), edits (category corrections), and deletions
  (false positives)
- p50/p95 provider latency and token-derived cost per image

## Live result status

The repository owner explicitly authorized a live MiMo run using a locally
installed, Git-ignored credential. The credential is not present in the report,
source tree, Git history, command line, or application logs. The final 20-image
report is committed at
[`results/mimo-v2.5-2026-07-21.json`](./results/mimo-v2.5-2026-07-21.json).

| Metric | MiMo V2.5 | Gate | Result |
| --- | ---: | ---: | --- |
| Schema success | 100% | 100% | pass |
| Precision | 57.14% | at least 85% | fail |
| Recall | 57.14% | at least 75% | fail |
| F1 | 57.14% | reported | — |
| Category accuracy | 95% | reported | — |
| Hallucination rate | 42.86% | at most 10% | fail |
| p50 latency | 3.72 s | reported | — |
| p95 latency | 8.59 s | at most 15 s | pass |
| Total cost | $0.009468 | reported | — |
| Cost per image | $0.000473 | reported | — |

Across the set, a user would need to add 15 missed ingredients, edit one
category, and delete 15 false positives. MiMo therefore passes structure and
latency but fails all quality gates. It may only generate provisional candidates
in an explicitly enabled test flow where every item starts unconfirmed and the
user can add, edit, delete, and selectively confirm it. It must not write
inventory automatically. Production recognition remains disabled by default;
manual entry is always available.

The previously configured OpenAI and Gemini environments returned HTTP 401 and
403 in one-image connectivity smoke tests, so no quality metric is inferred for
them. MiniMax was not called because M2.7 has no image-input capability.

## Current pricing assumptions

The harness uses current public pay-as-you-go rates and records configured model
names in every report. MiMo V2.5 defaults to $0.14/MTok cache-miss input and
$0.28/MTok output. Rates are environment-overridable so a benchmark can lock the
price effective on its run date. Cost is computed from provider usage, not image
size estimates.
