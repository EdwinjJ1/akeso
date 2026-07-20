import { expect, test } from 'vitest'

import { elapsedSeconds } from './health'

test('reports only completed uptime seconds', () => {
  expect(elapsedSeconds(1_000, 1_501)).toBe(0)
  expect(elapsedSeconds(1_000, 2_000)).toBe(1)
})
