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
      'packages/contracts/src/**/*.test.ts',
      'packages/domain/src/schemas.test.ts',
      'packages/domain/src/planner.test.ts',
      'packages/domain/src/fixtures.test.ts',
      // apps/app ships its wizard/flow logic as RN-free pure modules
      // (checkin.logic.ts, checkin-flow.ts) so the riskiest parts are
      // testable here without a native renderer.
      'apps/app/src/**/*.test.ts',
    ],
    // apps/api/src/env.ts refuses to start without either DEMO_MODE=true or
    // real Supabase credentials — tests always run in demo mode.
    env: {
      DEMO_MODE: 'true',
    },
  },
})
