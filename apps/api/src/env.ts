import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))

/**
 * Unlike node's loadEnvFile, values from the project .env OVERRIDE variables
 * inherited from the shell. The project file is authoritative for this app:
 * a stale shell export (e.g. a rotated GEMINI_API_KEY still exported from
 * ~/.zshrc) must not silently take precedence over the configured value.
 * Hosted deployments ship no .env file, so their platform env still applies.
 */
function applyEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
    )
    if (!match) continue
    const [, key, rawValue] = match
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  }
}

// Tests configure process.env themselves (vitest.config.ts and per-test
// setup) and must stay hermetic from the developer's local .env file.
if (!process.env.VITEST) applyEnvFile(envPath)

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

const REPO_DRIVERS = ['supabase', 'sqlite', 'memory'] as const
export type RepoDriver = (typeof REPO_DRIVERS)[number]

function parseRepoDriver(raw: string | undefined): RepoDriver {
  if (!raw) return demoMode ? 'memory' : 'supabase'
  if ((REPO_DRIVERS as readonly string[]).includes(raw)) {
    return raw as RepoDriver
  }
  throw new Error(
    `Invalid REPO_DRIVER ${JSON.stringify(raw)}; expected one of ${REPO_DRIVERS.join(', ')}.`
  )
}

const repoDriver = parseRepoDriver(process.env.REPO_DRIVER)

// sqlite/memory are single-user local modes with no auth, so like demo mode
// they are explicit opt-ins and are never allowed in production.
const localMode = repoDriver !== 'supabase'

if (repoDriver === 'supabase' && !hasSupabaseConfig) {
  throw new Error(
    'Set REPO_DRIVER=sqlite (persistent) or DEMO_MODE=true (in-memory) for local use, or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run for real.'
  )
}

if (localMode && isProduction) {
  throw new Error(
    `${demoMode ? 'DEMO_MODE=true' : `REPO_DRIVER=${repoDriver}`} is not allowed when NODE_ENV=production.`
  )
}

if (localMode) {
  console.warn(
    `⚠️  Local mode (${repoDriver}) is on — every request is attributed to one fixed user with no auth. Do not expose this deployment publicly.`
  )
}

export const env = {
  port: parsePort(process.env.PORT),
  demoMode,
  repoDriver,
  // In any non-Supabase driver there is no auth provider, so every request
  // maps to this single local user.
  localMode,
  demoUserId: process.env.DEMO_USER_ID || 'demo-user',
  sqlitePath:
    process.env.SQLITE_DB_PATH ||
    fileURLToPath(new URL('../data/akeso-local.db', import.meta.url)),
  supabase: hasSupabaseConfig
    ? { url: supabaseUrl!, serviceRoleKey: supabaseServiceRoleKey! }
    : undefined,
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  memoryRepoLimit: parsePositiveInt(process.env.MEMORY_REPO_LIMIT, 1000),
  vision: {
    enabled: process.env.VISION_FEATURE_ENABLED !== 'false',
    provider: process.env.VISION_PROVIDER ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_VISION_MODEL ?? 'gemini-3.5-flash-lite',
  },
  rateLimit: {
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 60),
    writeMax: parsePositiveInt(process.env.RATE_LIMIT_WRITE_MAX, 20),
  },
}
