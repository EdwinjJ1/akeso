import { fixtureTasks } from '@akeso/domain'
import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  Task,
  UserProfile,
} from '@akeso/domain'

import type { Repos } from './types'

const dateKey = (userId: string, date: string) => `${userId}::${date}`

/**
 * In-memory backing store used whenever Supabase env vars are absent
 * (local dev, tests, and the hackathon demo). Each call to createMemoryRepos
 * gets its own isolated state — nothing here is a module-level singleton.
 */
export function createMemoryRepos(): Repos {
  const profiles = new Map<string, UserProfile>()
  const checkins = new Map<string, CheckInInput>()
  const energyResults = new Map<string, EnergyResult>()
  const plans = new Map<string, DayPlan>()

  return {
    profile: {
      async get(userId) {
        return profiles.get(userId) ?? null
      },
      async upsert(userId, profile) {
        profiles.set(userId, profile)
        return profile
      },
    },

    checkins: {
      async upsert(userId, input) {
        checkins.set(dateKey(userId, input.date), input)
      },
    },

    energy: {
      async get(userId, date) {
        return energyResults.get(dateKey(userId, date)) ?? null
      },
      async upsert(userId, result) {
        energyResults.set(dateKey(userId, result.date), result)
        return result
      },
    },

    tasks: {
      async list(_userId: string, _date: string): Promise<Task[]> {
        return fixtureTasks
      },
    },

    plans: {
      async get(userId, date) {
        return plans.get(dateKey(userId, date)) ?? null
      },
      async upsert(userId, plan) {
        plans.set(dateKey(userId, plan.date), plan)
        return plan
      },
    },
  }
}
