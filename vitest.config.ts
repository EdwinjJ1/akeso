import { defineConfig } from 'vitest/config'

/**
 * Every test under packages/* and apps/api runs through vitest. The domain
 * engine test used to run on its own `node --test` pipeline, but once it
 * began exercising a shared validator re-exported from @akeso/contracts it
 * needed the same TS/ESM resolution the rest of the suite already gets from
 * vitest, so it lives here too now.
 */
export default defineConfig({
  test: {
    include: [
      'apps/api/src/**/*.test.ts',
      'packages/contracts/src/**/*.test.ts',
      'packages/domain/src/schemas.test.ts',
      'packages/domain/src/planner.test.ts',
      'packages/domain/src/fixtures.test.ts',
      'packages/domain/src/energy-engine.test.ts',
      'scripts/vision-eval/**/*.test.ts',
    ],
    // apps/api/src/env.ts refuses to start without either DEMO_MODE=true or
    // real Supabase credentials — tests always run in demo mode.
    env: {
      DEMO_MODE: 'true',
    },
  },
})
