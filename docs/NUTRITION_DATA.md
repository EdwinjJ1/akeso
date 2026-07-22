# Nutrition data and import notes

Issue #22 uses a small, versioned food-profile subset for the demo. It powers
matching only; it is general food-planning information and not a dietary or
medical prescription.

## Source and version

- Source: [FSANZ Australian Food Composition Database (AFCD)](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd)
- Upstream release: AFCD Release 3 (December 2025)
- Workbook: `Release 3 - Nutrient profiles.xlsx`, sheet
  `All solids & liquids per 100 g` (per 100 g edible portion)
- App dataset: `afcd-r3-demo-subset`, version `3.0-demo.2`, imported 2026-07-22
- Stored subset: `packages/domain/src/nutrition-data.ts`

The app deliberately stores only the eight demo-fridge foods rather than
copying the full 1,588-row database. Every stored profile records the exact
AFCD `Public Food Key` and `Food Name` of the row it was imported from, so the
subset is reproducible against the official workbook.

## Imported rows

| Profile id | Public Food Key | AFCD Food Name |
|---|---|---|
| `egg` | F003729 | Egg, chicken, whole, raw |
| `baby-spinach` | F008749 | Spinach, baby, fresh, raw |
| `salmon` | F007827 | Salmon, Atlantic, fillet, raw |
| `natural-yoghurt` | F009694 | Yoghurt, natural, regular fat (~3%) |
| `oats` | F006143 | Oats, rolled, uncooked |
| `blueberries` | F001290 | Blueberry, raw |
| `brown-rice` | F007641 | Rice, brown, boiled, no added salt |
| `red-capsicum` | F002247 | Capsicum, red, fresh, raw |

Release 3 has no "Greek style" yoghurt row, so the demo dairy item is natural
yoghurt (F009694); a fridge entry "greek yogurt" is left unmapped rather than
silently substituted. Brown rice imports the boiled row because a fridge item
is the cooked leftover — the uncooked grain lives in the pantry.

## Nutrient field mapping

| App key | Workbook column | Unit handling |
|---|---|---|
| `protein` | Protein (g) | as-is |
| `complex_carbs` | Starch (g) | as-is; "available carbohydrate" is NOT used |
| `fiber` | Total dietary fibre (g) | as-is |
| `iron` | Iron (Fe) (mg) | as-is |
| `vitamin_c` | Vitamin C (mg) | as-is |
| `omega3` | Total long chain omega 3 fatty acids, equated (mg) | ÷ 1000 → grams |

`omega3` counts long-chain omega-3 only; plant ALA is intentionally excluded,
which is why plant foods store 0. A nutrient the workbook reports as 0 is a
true zero; the demo subset contains no blank cells for the mapped columns.

## Alias policy

An alias must identify a single AFCD row for a typical fridge item. Generic
household names whose retail variants differ materially — `rice` (raw vs
boiled differ ~8x), `yogurt` (styles differ ~2x in protein), `spinach`
(baby vs mature iron differs ~2x), `capsicum` (colours differ in vitamin C),
bare `salmon` (raw vs smoked vs canned) — are deliberately not aliases. Such
entries fall back to "unmapped" and contribute zero rather than silently
becoming one specific food. `packages/domain/src/nutrition-data.test.ts`
enforces this list.

## Import/update procedure

1. Download the current AFCD Nutrient profiles workbook from the FSANZ
   data-files page and open sheet `All solids & liquids per 100 g` (headers on
   row 3).
2. Locate each profile's row by its recorded `Public Food Key`; confirm the
   `Food Name` still matches verbatim. Never substitute a similarly named
   food — if a row disappeared, remove or re-source the profile explicitly.
3. Copy the mapped columns listed above, applying only the documented mg→g
   conversion for omega-3.
4. Update the expected values in `nutrition-data.test.ts` and the fixed
   fixture expectations in `nutrition-engine.test.ts`, then run `npm test`.
5. Bump `NUTRITION_DATASET.version`, update this file and review every
   changed meal/need result before release.

## Calculation and fallbacks

- A mapped fridge item contributes `per100g × quantityGrams / 100`. Until
  Issue #21 supplies a quantity, the profile's documented default serving is
  used. The engine already accepts optional `quantityGrams` for that handoff.
- Totals accumulate at full precision and are rounded once at the end;
  per-item contributions are rounded for display only, so their sum can
  differ from the total by the last decimal.
- Water is counted only from an explicitly supplied drinking amount; water
  content in food is never estimated. Check-in hydration bands convert to
  litres via `hydrationLitresFromBand`, which takes each band's conservative
  lower bound (`1_1_5l` → 1 L) and treats `not_sure` as "nothing logged".
  Missing, negative or non-finite logged amounts safely contribute zero.
- An unknown or ambiguous food name, or a name/category conflict, is shown as
  unmapped and contributes no invented nutrient values.
- A meal uses available fridge item IDs only. If a recipe has enough available
  ingredients but is incomplete, its description and tag explicitly say
  `needs purchase: …`.
- Each nutrient note reports the amount or percentage still needed to reach
  its target. Food coverage means nutrients mapped from available inventory,
  not confirmed food consumption; hydration coverage means explicitly logged
  water.

## Targets

Targets are fixed demo planning baselines for a generic adult-student flow,
declared per nutrient in `NUTRIENT_TARGETS` with a `basis` string that states
where each number comes from. Two match a published NHMRC NRV exactly
(vitamin C 45 mg = adult RDI; fibre 30 g = adult-male adequate intake); the
rest are labelled demo baselines positioned relative to the published NHMRC
range. They are not personalised NRVs, clinical advice or treatment.
