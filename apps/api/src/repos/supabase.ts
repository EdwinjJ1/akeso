import type {
  CheckInInput,
  DayPlan,
  EnergyResult,
  FridgeItem,
  NutritionPlan,
  PlanBlock,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

import { getSupabaseClient } from '../supabase'
import type { Repos } from './types'

interface PostgrestResult<T> {
  data: T | null
  error: { message: string } | null
}

function unwrap<T>(result: PostgrestResult<T>, context: string): T | null {
  if (result.error) throw new Error(`${context}: ${result.error.message}`)
  return result.data
}

interface UserProfileRow {
  display_name: string
  goal: UserProfile['goal']
  typical_wake: string
  typical_sleep: string
  dietary_preference: UserProfile['dietaryPreference']
  dietary_safety: UserProfile['dietarySafety'] | null
}

interface EnergyResultRow {
  date: string
  score: number
  band: EnergyResult['band']
  headline: string
  factors: EnergyResult['factors']
  curve: EnergyResult['curve']
  peak_window: EnergyResult['peakWindow']
  dip_window: EnergyResult['dipWindow']
  computed_at: string
}

interface TaskRow {
  id: string
  title: string
  priority: Task['priority']
  energy_demand: Task['energyDemand']
  estimated_minutes: number
  status: Task['status']
}

interface DayPlanRow {
  coach_note: string
  generated_at: string
}

interface PlanBlockRow {
  id: string
  start_time: string
  end_time: string
  type: PlanBlock['type']
  title: string
  task_id: string | null
  energy_level: PlanBlock['energyLevel']
  rationale: string
}

interface FridgeItemRow {
  id: string
  name: string
  category: FridgeItem['category']
  allergen_tags: FridgeItem['allergenTags'] | null
}

interface ReminderPreferenceRow {
  enabled: boolean
  check_in_time: string
  timezone: string
}

interface NutritionPlanCacheRow {
  plan: NutritionPlan
}

/**
 * Supabase-backed repos (service role). Used whenever SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are configured — see env.ts / repos/index.ts.
 * Table shapes match apps/api/supabase/migrations/0001_init.sql.
 */
export function createSupabaseRepos(): Repos {
  const supabase = getSupabaseClient()

  return {
    profile: {
      async get(userId) {
        const row = unwrap<UserProfileRow>(
          await supabase
            .from('user_profile')
            .select(
              'display_name, goal, typical_wake, typical_sleep, dietary_preference, dietary_safety'
            )
            .eq('user_id', userId)
            .maybeSingle(),
          'user_profile.get'
        )
        if (!row) return null
        return {
          displayName: row.display_name,
          goal: row.goal,
          typicalWake: row.typical_wake,
          typicalSleep: row.typical_sleep,
          dietaryPreference: row.dietary_preference,
          dietarySafety: row.dietary_safety ?? {
            allergens: [],
            avoidIngredients: [],
          },
        }
      },
      async upsert(userId, profile) {
        unwrap(
          await supabase.from('user_profile').upsert(
            {
              user_id: userId,
              display_name: profile.displayName,
              goal: profile.goal,
              typical_wake: profile.typicalWake,
              typical_sleep: profile.typicalSleep,
              dietary_preference: profile.dietaryPreference,
              dietary_safety: profile.dietarySafety,
            },
            { onConflict: 'user_id' }
          ),
          'user_profile.upsert'
        )
        return profile
      },
    },

    checkins: {
      async upsert(userId, input: CheckInInput) {
        unwrap(
          await supabase.from('checkin').upsert(
            {
              user_id: userId,
              date: input.date,
              reported_energy: input.reportedEnergy,
              sleep_duration: input.sleepDuration,
              last_meal_timing: input.lastMealTiming,
              last_meal_description: input.lastMealDescription ?? null,
              hydration: input.hydration,
            },
            { onConflict: 'user_id,date' }
          ),
          'checkin.upsert'
        )
      },
    },

    energy: {
      async get(userId, date) {
        const row = unwrap<EnergyResultRow>(
          await supabase
            .from('energy_result')
            .select(
              'date, score, band, headline, factors, curve, peak_window, dip_window, computed_at'
            )
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle(),
          'energy_result.get'
        )
        if (!row) return null
        return {
          date: row.date,
          score: row.score,
          band: row.band,
          headline: row.headline,
          factors: row.factors,
          curve: row.curve,
          peakWindow: row.peak_window,
          dipWindow: row.dip_window,
          computedAt: row.computed_at,
        }
      },
      async upsert(userId, result: EnergyResult) {
        unwrap(
          await supabase.from('energy_result').upsert(
            {
              user_id: userId,
              date: result.date,
              score: result.score,
              band: result.band,
              headline: result.headline,
              factors: result.factors,
              curve: result.curve,
              peak_window: result.peakWindow,
              dip_window: result.dipWindow,
              computed_at: result.computedAt,
            },
            { onConflict: 'user_id,date' }
          ),
          'energy_result.upsert'
        )
        return result
      },
    },

    tasks: {
      async list(userId, date) {
        const rows =
          unwrap<TaskRow[]>(
            await supabase
              .from('task')
              .select('id, title, priority, energy_demand, estimated_minutes, status')
              .eq('user_id', userId)
              .eq('date', date),
            'task.list'
          ) ?? []
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          priority: row.priority,
          energyDemand: row.energy_demand,
          estimatedMinutes: row.estimated_minutes,
          status: row.status,
        }))
      },
    },

    plans: {
      async get(userId, date) {
        const dayPlanRow = unwrap<DayPlanRow>(
          await supabase
            .from('day_plan')
            .select('coach_note, generated_at')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle(),
          'day_plan.get'
        )
        if (!dayPlanRow) return null

        const blockRows =
          unwrap<PlanBlockRow[]>(
            await supabase
              .from('plan_block')
              .select('id, start_time, end_time, type, title, task_id, energy_level, rationale')
              .eq('user_id', userId)
              .eq('date', date)
              .order('start_time', { ascending: true }),
            'plan_block.get'
          ) ?? []

        return {
          date,
          blocks: blockRows.map((row) => ({
            id: row.id,
            start: row.start_time,
            end: row.end_time,
            type: row.type,
            title: row.title,
            taskId: row.task_id ?? undefined,
            energyLevel: row.energy_level,
            rationale: row.rationale,
          })),
          coachNote: dayPlanRow.coach_note,
          generatedAt: dayPlanRow.generated_at,
        }
      },
      async upsert(userId, plan: DayPlan) {
        unwrap(
          await supabase.from('day_plan').upsert(
            {
              user_id: userId,
              date: plan.date,
              coach_note: plan.coachNote,
              generated_at: plan.generatedAt,
            },
            { onConflict: 'user_id,date' }
          ),
          'day_plan.upsert'
        )

        // Whole-day regenerate: replace every block for this date. Not
        // transactional across the two calls, but the plan is always
        // regenerated wholesale, so a partial write is self-correcting on
        // the next regenerate.
        unwrap(
          await supabase
            .from('plan_block')
            .delete()
            .eq('user_id', userId)
            .eq('date', plan.date),
          'plan_block.delete'
        )

        if (plan.blocks.length > 0) {
          unwrap(
            await supabase.from('plan_block').insert(
              plan.blocks.map((block) => ({
                id: block.id,
                user_id: userId,
                date: plan.date,
                start_time: block.start,
                end_time: block.end,
                type: block.type,
                title: block.title,
                task_id: block.taskId ?? null,
                energy_level: block.energyLevel,
                rationale: block.rationale,
              }))
            ),
            'plan_block.insert'
          )
        }

        return plan
      },
    },

    fridge: {
      async list(userId) {
        const rows =
          unwrap<FridgeItemRow[]>(
            await supabase
              .from('fridge_item')
              .select('id, name, category, allergen_tags')
              .eq('user_id', userId)
              .order('created_at', { ascending: true }),
            'fridge_item.list'
          ) ?? []
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          allergenTags: row.allergen_tags ?? [],
        }))
      },
      async upsert(userId, item: FridgeItem) {
        unwrap(
          await supabase.from('fridge_item').upsert(
            {
              id: item.id,
              user_id: userId,
              name: item.name,
              category: item.category,
              allergen_tags: item.allergenTags,
            },
            { onConflict: 'user_id,id' }
          ),
          'fridge_item.upsert'
        )
        return item
      },
      async remove(userId, id) {
        unwrap(
          await supabase
            .from('fridge_item')
            .delete()
            .eq('user_id', userId)
            .eq('id', id),
          'fridge_item.remove'
        )
      },
    },

    nutritionPlanCache: {
      async get(userId, cacheKey) {
        const row = unwrap<NutritionPlanCacheRow>(
          await supabase
            .from('nutrition_plan_cache')
            .select('plan')
            .eq('user_id', userId)
            .eq('cache_key', cacheKey)
            .maybeSingle(),
          'nutrition_plan_cache.get'
        )
        return row?.plan ?? null
      },
      async upsert(userId, cacheKey, plan) {
        unwrap(
          await supabase.from('nutrition_plan_cache').upsert(
            {
              user_id: userId,
              cache_key: cacheKey,
              date: plan.date,
              plan,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,cache_key' }
          ),
          'nutrition_plan_cache.upsert'
        )
      },
    },

    reminders: {
      async get(userId) {
        const row = unwrap<ReminderPreferenceRow>(
          await supabase
            .from('reminder_preference')
            .select('enabled, check_in_time, timezone')
            .eq('user_id', userId)
            .maybeSingle(),
          'reminder_preference.get'
        )
        if (!row) return null
        return {
          enabled: row.enabled,
          checkInTime: row.check_in_time,
          timezone: row.timezone,
        }
      },
      async upsert(userId, pref: ReminderPreference) {
        unwrap(
          await supabase.from('reminder_preference').upsert(
            {
              user_id: userId,
              enabled: pref.enabled,
              check_in_time: pref.checkInTime,
              timezone: pref.timezone,
              // The column's default now() only fires on insert — without this
              // an updated row would keep its original timestamp forever.
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          ),
          'reminder_preference.upsert'
        )
        return pref
      },
    },
  }
}
