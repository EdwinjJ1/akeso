import { defineConfig } from 'vitest/config'

/**
 * packages/domain/src/energy-engine.test.ts runs through its own
 * `node --test` pipeline (see that package's package.json) rather than
 * vitest, so it's deliberately left out of this include list — everything
 * else under packages/domain and apps/api uses vitest directly.
 */
export default defineConfig({
  test: {
    include: [
      'apps/api/src/**/*.test.ts',
      'apps/app/src/services/**/*.test.ts',
      'packages/contracts/src/**/*.test.ts',
      'packages/domain/src/schemas.test.ts',
      'packages/domain/src/planner.test.ts',
      'packages/domain/src/fixtures.test.ts',
    ],
    // apps/api/src/env.ts refuses to start without either DEMO_MODE=true or
    // real Supabase credentials — tests always run in demo mode.
    env: {
      DEMO_MODE: 'true',
    },
  },
})
