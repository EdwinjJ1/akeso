import type { AkesoService } from '@akeso/domain'

import { FixtureService } from './fixture-service'

/**
 * The swap point (TEAM_CONTRACT §4.1). During UI development this returns
 * the FixtureService; at integration it becomes `new ApiService(baseUrl)`.
 * Nothing else in the app changes.
 */
const service: AkesoService = new FixtureService()

export function getService(): AkesoService {
  return service
}
