-- Dietary safety profile (P0 App/Contracts).
--
-- Stores user-reported allergies and avoid-list text with the existing
-- onboarding profile. This is not a medical record; it is used to filter meal
-- suggestions away from foods the user told Akeso to avoid.
-- Shape matches UserProfile.dietarySafety in packages/contracts/src/schemas.ts.

alter table user_profile
  add column dietary_safety jsonb not null default
    '{"allergens":[],"avoidIngredients":[]}'::jsonb;

alter table fridge_item
  add column allergen_tags jsonb not null default
    '[]'::jsonb;
