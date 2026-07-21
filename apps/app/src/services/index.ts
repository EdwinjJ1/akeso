import type { AkesoService } from '@akeso/domain'

import { ApiService } from './api-service'
import { FixtureService } from './fixture-service'

/**
 * The swap point (TEAM_CONTRACT §4.1). Set EXPO_PUBLIC_API_URL to point the
 * app at the real Express API (see apps/api/.env.example) — otherwise it
 * falls back to the in-memory FixtureService demo. Nothing else in the app
 * changes either way.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL

const service: AkesoService = apiUrl ? new ApiService(apiUrl) : new FixtureService()

export function getService(): AkesoService {
  return service
}
