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
      'packages/domain/src/schemas.test.ts',
      'packages/domain/src/planner.test.ts',
    ],
  },
})
