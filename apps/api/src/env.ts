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

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey)

// Demo mode (in-memory repos, no auth) is the default whenever Supabase
// isn't configured. DEMO_MODE can force either direction explicitly.
const demoMode = process.env.DEMO_MODE
  ? process.env.DEMO_MODE === 'true'
  : !hasSupabaseConfig

if (!demoMode && !hasSupabaseConfig) {
  throw new Error(
    'DEMO_MODE=false requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set'
  )
}

export const env = {
  port: parsePort(process.env.PORT),
  demoMode,
  demoUserId: process.env.DEMO_USER_ID || 'demo-user',
  supabase: hasSupabaseConfig
    ? { url: supabaseUrl!, serviceRoleKey: supabaseServiceRoleKey! }
    : undefined,
}
