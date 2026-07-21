import { fixtureTasks } from '@akeso/domain'
import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  FridgeItem,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

import { env } from '../env'
import type { Repos } from './types'

const dateKey = (userId: string, date: string) => `${userId}::${date}`

/**
 * A Map capped at `limit` entries, evicting the oldest (insertion-order)
 * entry once exceeded. Without this, an unbounded number of distinct
 * user/date keys — whether from real usage or someone hammering the API —
 * would grow this process's memory forever, since nothing here ever expires
 * on its own.
 */
function createBoundedMap<K, V>(limit: number) {
  const map = new Map<K, V>()
  return {
    get: (key: K) => map.get(key),
    set: (key: K, value: V) => {
      map.delete(key)
      map.set(key, value)
      if (map.size > limit) {
        const oldestKey = map.keys().next().value
        if (oldestKey !== undefined) map.delete(oldestKey)
      }
    },
  }
}

/**
 * In-memory backing store used whenever Supabase env vars are absent
 * (local dev, tests, and the hackathon demo). Each call to createMemoryRepos
 * gets its own isolated state — nothing here is a module-level singleton.
 */
export function createMemoryRepos(): Repos {
  const limit = env.memoryRepoLimit
  const profiles = createBoundedMap<string, UserProfile>(limit)
  const checkins = createBoundedMap<string, CheckInInput>(limit)
  const energyResults = createBoundedMap<string, EnergyResult>(limit)
  const plans = createBoundedMap<string, DayPlan>(limit)
  const fridgeByUser = createBoundedMap<string, Map<string, FridgeItem>>(limit)
  const reminders = createBoundedMap<string, ReminderPreference>(limit)
  const nutritionPlans = createBoundedMap<string, NutritionPlan>(limit)

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

    fridge: {
      async list(userId) {
        return Array.from((fridgeByUser.get(userId) ?? new Map()).values())
      },
      async upsert(userId, item) {
        const items = fridgeByUser.get(userId) ?? new Map<string, FridgeItem>()
        items.set(item.id, item)
        fridgeByUser.set(userId, items)
        return item
      },
      async remove(userId, id) {
        fridgeByUser.get(userId)?.delete(id)
      },
    },

    nutritionPlanCache: {
      async get(userId, cacheKey) {
        return nutritionPlans.get(dateKey(userId, cacheKey)) ?? null
      },
      async upsert(userId, cacheKey, plan) {
        nutritionPlans.set(dateKey(userId, cacheKey), plan)
      },
    },

    reminders: {
      async get(userId) {
        return reminders.get(userId) ?? null
      },
      async upsert(userId, pref) {
        reminders.set(userId, pref)
        return pref
      },
    },
  }
}
