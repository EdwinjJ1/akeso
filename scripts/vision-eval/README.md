# Ingredient vision evaluation

This harness measures presence-only ingredient recognition against 20 publicly
licensed Wikimedia Commons images. It downloads each image into memory for the
duration of one evaluation request; the repository contains only URLs,
attribution, licenses, scene labels, and human ground truth.

## Providers

| Provider | Default model | Vision status | Structured output |
| --- | --- | --- | --- |
| Xiaomi MiMo (domestic) | `mimo-v2.5` | supported | JSON object mode, then shared Zod validation |
| OpenAI | `gpt-5.6-luna` | supported | strict JSON Schema, then shared Zod validation |
| Gemini | `gemini-3.1-flash-lite` | supported | response JSON Schema, then shared Zod validation |
| MiniMax (domestic) | `MiniMax-M2.7` | unsupported | blocked before a request is sent |

MiMo V2/V2 Flash is intentionally not supported because Xiaomi retired the V2
model names on 2026-06-30. MiniMax M2.7 remains a candidate for text-only
nutrition suggestions, not fridge-image recognition.

## Run

Use newly issued server-only credentials. Do not put keys in CLI arguments,
source files, reports, or shell history.

```sh
MIMO_API_KEY=... npm run vision:eval -- \
  --providers mimo \
  --output .local/vision-eval/mimo.json
```

The runner loads `apps/api/.env` by default, or an explicitly selected local
file with `--env-file`. Supported configuration:

- `MIMO_API_KEY`, `MIMO_VISION_MODEL` (default `mimo-v2.5`)
- `OPENAI_API_KEY`, `OPENAI_VISION_MODEL` (default `gpt-5.6-luna`)
- `GEMINI_API_KEY`, `GEMINI_VISION_MODEL` (default `gemini-3.1-flash-lite`)
- optional per-provider `*_INPUT_USD_PER_MTOK` and
  `*_OUTPUT_USD_PER_MTOK` overrides

Validate the manifest and capability matrix without sending an image:

```sh
npm run vision:eval:check
```

For a deliberately small smoke test, add `--limit 1`. A live run requires an
explicit comma-separated `--providers` list so the harness cannot accidentally
broadcast an image to every configured supplier.

## Admission gates

- schema success: 100%
- precision: at least 85%
- recall: at least 75%
- hallucination rate: at most 10%
- p95 provider latency: at most 15 seconds

The report also contains F1, category accuracy, human additions/edits/deletions,
p50/p95 latency, tokens, total cost, and cost per image. Each report locks the
actual configured model name. A provider is not eligible for production until a
complete 20-image report passes every gate.

## Safety properties

- 5 MiB maximum image size and JPEG/PNG/WebP signature validation
- 15-second timeout per attempt
- exactly one retry, only for HTTP 429 or 5xx
- images remain in memory and are not logged or written to disk
- output is parsed and revalidated with `IngredientRecognitionResultSchema`
- empty and refusal results contain no fabricated ingredients
