import { defineConfig } from 'vitest/config'

/**
 * packages/domain runs its tests through its own `node --test` pipeline
 * (see its package.json) — scope the root vitest run to apps/api so it
 * doesn't try to execute that file as a vitest suite.
 */
export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.test.ts'],
  },
})
