import { readFile, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'

import { parsePort } from './env'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
const originalPort = process.env.PORT
let originalEnvFile: string | undefined

beforeAll(async () => {
  try {
    originalEnvFile = await readFile(envPath, 'utf8')
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }

  await writeFile(envPath, 'PORT=4123\n')
})

beforeEach(() => {
  delete process.env.PORT
  vi.resetModules()
})

afterAll(async () => {
  if (originalPort === undefined) delete process.env.PORT
  else process.env.PORT = originalPort

  if (originalEnvFile === undefined) await unlink(envPath)
  else await writeFile(envPath, originalEnvFile)
})

/**
 * env.ts skips the .env file entirely under vitest (tests stay hermetic from
 * the developer's local config), so these two tests drop the VITEST flag for
 * the duration of the import to exercise the real file-loading path.
 */
async function importEnvWithFileLoading() {
  const vitestFlag = process.env.VITEST
  delete process.env.VITEST
  try {
    return await import('./env')
  } finally {
    process.env.VITEST = vitestFlag
  }
}

test('loads PORT from the API-local .env file', async () => {
  const { env } = await importEnvWithFileLoading()

  expect(env.port).toBe(4123)
})

test('.env file values override variables inherited from the shell', async () => {
  // Regression guard: a stale shell export (e.g. a rotated API key still in
  // ~/.zshrc) must lose to the project .env, not silently win.
  process.env.PORT = '9999'
  const { env } = await importEnvWithFileLoading()

  expect(env.port).toBe(4123)
})

test('uses port 3001 when PORT is absent', () => {
  expect(parsePort(undefined)).toBe(3001)
})

test('accepts a valid TCP port', () => {
  expect(parsePort('65535')).toBe(65535)
})

test.each(['0', '65536', '12.5', 'not-a-port'])(
  'rejects invalid PORT value %s',
  (raw) => {
    expect(() => parsePort(raw)).toThrow(`Invalid PORT env var: ${JSON.stringify(raw)}`)
  }
)
