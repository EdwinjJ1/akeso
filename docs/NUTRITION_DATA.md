# Nutrition data and import notes

Issue #22 uses a small, versioned food-profile subset for the demo. It powers
matching only; it is general food-planning information and not a dietary or
medical prescription.

## Source and version

- Source: [FSANZ Australian Food Composition Database (AFCD)](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd)
- Upstream release: AFCD Release 3 (December 2025)
- App dataset: `afcd-r3-demo-subset`, version `3.0-demo.1`, imported 2026-07-21
- Stored subset: `packages/domain/src/nutrition-data.ts`

FSANZ supplies the Release 3 food-details workbook, nutrient-profile workbook,
nutrient-details workbook and food-group workbook for software import. The
upstream database reports nutrient values per 100g edible portion and includes
derivation and sampling metadata. The app deliberately stores only the eight
fictional demo-fridge foods rather than copying the full database.

## Import/update procedure

1. Download the current AFCD Food details, Nutrient profiles, Nutrient details
   and Food Group information workbooks from the FSANZ data-files page.
2. Record the AFCD release date and each source food description before editing
   the local profile list; do not silently substitute a similarly named food.
3. Map per-100g protein, available/starchy carbohydrate used by the product as
   `complex_carbs`, dietary fibre, iron, vitamin C and omega-3 into the local
   profile. Preserve the source unit; do not convert a missing value to zero
   unless the AFCD record actually reports zero.
4. Add accepted manual-entry aliases and the Australian Dietary Guidelines food
   group. Run `npm test` and review the fixed-fixture expectations.
5. Bump `NUTRITION_DATASET.version`, update this file and review every changed
   meal/need result before release.

## Calculation and fallbacks

- A mapped fridge item contributes `per100g × quantityGrams / 100`. Until
  Issue #21 supplies a quantity, the profile's documented default serving is
  used. The engine already accepts optional `quantityGrams` for that handoff.
- Water is counted only from an explicitly supplied drinking-water amount;
  water content in food is never estimated.
- An unknown food name, a missing numeric quantity or an unmapped category is
  shown as unmapped and contributes no invented nutrient values.
- A meal uses available fridge item IDs only. If a recipe has enough available
  ingredients but is incomplete, its description and tag explicitly say
  `needs purchase: …`.
- Targets are transparent, generic demo planning baselines for an adult student
  flow. They are not personalised requirements, clinical advice or treatment.
