import { FIXTURE_DATE } from '@akeso/contracts'
import type { UserProfile } from './types'

/**
 * Demo fixture data. Entirely fictional (see TEAM_CONTRACT §4.4) — no real
 * health data. The API team seeds the demo database with these same values
 * so the app looks identical before and after integration.
 *
 * The canonical shared fixtures (check-in, energy result, tasks, plan,
 * coach) live in `@akeso/contracts` and are re-exported here; only fixtures
 * for domain-specific types are defined locally.
 */

export {
  fixtureCheckIn,
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureEnergyResult,
  fixtureTasks,
} from '@akeso/contracts'

export { FIXTURE_DATE }

export const fixtureProfile: UserProfile = {
  displayName: 'Alex',
  goal: 'academic',
  typicalWake: '07:30',
  typicalSleep: '23:30',
  dietaryPreference: 'none',
  dietarySafety: {
    allergens: [],
    avoidIngredients: [],
  },
}
