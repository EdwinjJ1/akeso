import type { AkesoService } from '@akeso/domain'

import { ApiService } from './api-service'
import { FixtureService } from './fixture-service'
import { isSupabaseConfigured } from './supabase-client'

/**
 * The swap point (TEAM_CONTRACT §4.1). Set EXPO_PUBLIC_API_URL to point the
 * app at the real Express API (see apps/app/.env.example) — otherwise it
 * falls back to the in-memory FixtureService demo. Nothing else in the app
 * changes either way.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL
const demoApi = process.env.EXPO_PUBLIC_DEMO_MODE === 'true'

// ApiService needs Supabase Auth for its bearer token — half-configured env
// would otherwise surface as a runtime error on every single request.
if (apiUrl && !demoApi && !isSupabaseConfigured()) {
  console.warn(
    'EXPO_PUBLIC_API_URL is set but EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not — falling back to the FixtureService demo.'
  )
}

const service: AkesoService =
  apiUrl && (demoApi || isSupabaseConfigured())
    ? new ApiService(apiUrl, demoApi)
    : new FixtureService()

export function getService(): AkesoService {
  return service
}
