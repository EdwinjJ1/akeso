import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))

if (existsSync(envPath)) loadEnvFile(envPath)

export function parsePort(raw: string | undefined): number {
  if (!raw) return 3001
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT env var: ${JSON.stringify(raw)}`)
  }
  return port
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected a positive integer, got ${JSON.stringify(raw)}`)
  }
  return value
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return ['http://localhost:8081', 'http://localhost:19006']
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey)
const isProduction = process.env.NODE_ENV === 'production'

// Demo mode is opt-in, never a silent fallback: forgetting to configure
// Supabase in a real deployment must fail to start, not quietly run with
// no auth and one shared user for every request.
const demoMode = process.env.DEMO_MODE === 'true'

if (!demoMode && !hasSupabaseConfig) {
  throw new Error(
    'Set DEMO_MODE=true for local/demo use, or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run for real.'
  )
}

if (demoMode && isProduction) {
  throw new Error('DEMO_MODE=true is not allowed when NODE_ENV=production.')
}

if (demoMode) {
  console.warn(
    '⚠️  DEMO_MODE is on — every request is attributed to one fixed user with no auth. Do not expose this deployment publicly.'
  )
}

export const env = {
  port: parsePort(process.env.PORT),
  demoMode,
  demoUserId: process.env.DEMO_USER_ID || 'demo-user',
  supabase: hasSupabaseConfig
    ? { url: supabaseUrl!, serviceRoleKey: supabaseServiceRoleKey! }
    : undefined,
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  memoryRepoLimit: parsePositiveInt(process.env.MEMORY_REPO_LIMIT, 1000),
  rateLimit: {
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 60),
    writeMax: parsePositiveInt(process.env.RATE_LIMIT_WRITE_MAX, 20),
  },
}
