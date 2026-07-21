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

test('loads PORT from the API-local .env file', async () => {
  const { env } = await import('./env')

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
