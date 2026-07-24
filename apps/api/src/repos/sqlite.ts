import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { fixtureTasks } from '@akeso/domain'
import type {
  CheckInInput,
  ContextNote,
  DayPlan,
  EnergyResult,
  FridgeItem,
  HealthReport,
  HealthRecommendationSet,
  NutritionPlan,
  ReminderPreference,
  Task,
  UserProfile,
} from '@akeso/domain'

import { env } from '../env'
import type { Repos } from './types'

/**
 * Local persistent storage: the user's personal record (profile, check-ins,
 * plans, health reports, and later Apple Health metrics) lives in a single
 * SQLite file on this machine instead of a hosted database.
 *
 * Tables are deliberately document-shaped — scoping keys as real columns and
 * the validated domain object as JSON — because every row is written from an
 * already-validated domain type and read back whole. That keeps this driver
 * schema-drift-free: new domain fields persist without a migration.
 */
const SCHEMA = `
  create table if not exists user_profile (
    user_id text primary key,
    data    text not null
  );
  create table if not exists checkin (
    user_id text not null,
    date    text not null,
    data    text not null,
    primary key (user_id, date)
  );
  create table if not exists energy_result (
    user_id text not null,
    date    text not null,
    data    text not null,
    primary key (user_id, date)
  );
  create table if not exists day_plan (
    user_id text not null,
    date    text not null,
    data    text not null,
    primary key (user_id, date)
  );
  create table if not exists fridge_item (
    user_id text not null,
    id      text not null,
    data    text not null,
    primary key (user_id, id)
  );
  create table if not exists nutrition_plan_cache (
    user_id   text not null,
    cache_key text not null,
    data      text not null,
    primary key (user_id, cache_key)
  );
  create table if not exists reminder_preference (
    user_id text primary key,
    data    text not null
  );
  create table if not exists health_report (
    user_id    text not null,
    id         text not null,
    created_at text not null,
    data       text not null,
    primary key (user_id, id)
  );
  create index if not exists health_report_recency
    on health_report (user_id, created_at desc);
  create table if not exists report_recommendation_cache (
    user_id   text not null,
    cache_key text not null,
    report_id text not null,
    data      text not null,
    primary key (user_id, cache_key)
  );
  -- "Tell Akeso more" free-text notes enriching a day's coach context.
  create table if not exists context_note (
    user_id    text not null,
    id         text not null,
    date       text not null,
    created_at text not null,
    data       text not null,
    primary key (user_id, id)
  );
  create index if not exists context_note_by_day
    on context_note (user_id, date, created_at);
  -- Ready for Apple Health / Apple Watch ingestion: device samples land here
  -- alongside the rest of the personal record. 'source' distinguishes
  -- apple_health / report / manual entries.
  create table if not exists health_metric_sample (
    user_id     text not null,
    id          text not null,
    source      text not null,
    kind        text not null,
    recorded_at text not null,
    data        text not null,
    primary key (user_id, id)
  );
  create index if not exists health_metric_sample_recency
    on health_metric_sample (user_id, recorded_at desc);
`

const parse = <T>(data: string): T => JSON.parse(data) as T

export function createSqliteRepos(path: string = env.sqlitePath): Repos {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('pragma journal_mode = wal')
  db.exec(SCHEMA)

  const getOne = (sql: string, ...params: string[]): string | null => {
    const row = db.prepare(sql).get(...params) as { data?: string } | undefined
    return row?.data ?? null
  }
  const getAll = (sql: string, ...params: string[]): string[] => {
    const rows = db.prepare(sql).all(...params) as { data: string }[]
    return rows.map((row) => row.data)
  }
  const run = (sql: string, ...params: string[]): void => {
    db.prepare(sql).run(...params)
  }

  return {
    profile: {
      async get(userId) {
        const data = getOne(
          'select data from user_profile where user_id = ?',
          userId
        )
        return data ? parse<UserProfile>(data) : null
      },
      async upsert(userId, profile) {
        run(
          `insert into user_profile (user_id, data) values (?, ?)
           on conflict (user_id) do update set data = excluded.data`,
          userId,
          JSON.stringify(profile)
        )
        return profile
      },
    },

    checkins: {
      async get(userId, date) {
        const data = getOne(
          'select data from checkin where user_id = ? and date = ?',
          userId,
          date
        )
        return data ? parse<CheckInInput>(data) : null
      },
      async upsert(userId, input) {
        run(
          `insert into checkin (user_id, date, data) values (?, ?, ?)
           on conflict (user_id, date) do update set data = excluded.data`,
          userId,
          input.date,
          JSON.stringify(input)
        )
      },
    },

    energy: {
      async get(userId, date) {
        const data = getOne(
          'select data from energy_result where user_id = ? and date = ?',
          userId,
          date
        )
        return data ? parse<EnergyResult>(data) : null
      },
      async upsert(userId, result) {
        run(
          `insert into energy_result (user_id, date, data) values (?, ?, ?)
           on conflict (user_id, date) do update set data = excluded.data`,
          userId,
          result.date,
          JSON.stringify(result)
        )
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
        const data = getOne(
          'select data from day_plan where user_id = ? and date = ?',
          userId,
          date
        )
        return data ? parse<DayPlan>(data) : null
      },
      async upsert(userId, plan) {
        run(
          `insert into day_plan (user_id, date, data) values (?, ?, ?)
           on conflict (user_id, date) do update set data = excluded.data`,
          userId,
          plan.date,
          JSON.stringify(plan)
        )
        return plan
      },
      async updateBlock(userId, date, updatedBlock) {
        const data = getOne(
          'select data from day_plan where user_id = ? and date = ?',
          userId,
          date
        )
        if (!data) throw new Error(`No plan exists for ${date}`)
        const plan = parse<DayPlan>(data)
        const next: DayPlan = {
          ...plan,
          blocks: plan.blocks
            .map((block) =>
              block.id === updatedBlock.id ? updatedBlock : block
            )
            .sort((left, right) => left.start.localeCompare(right.start)),
        }
        run(
          'update day_plan set data = ? where user_id = ? and date = ?',
          JSON.stringify(next),
          userId,
          date
        )
      },
    },

    fridge: {
      async list(userId) {
        return getAll(
          'select data from fridge_item where user_id = ?',
          userId
        ).map((data) => parse<FridgeItem>(data))
      },
      async upsert(userId, item) {
        run(
          `insert into fridge_item (user_id, id, data) values (?, ?, ?)
           on conflict (user_id, id) do update set data = excluded.data`,
          userId,
          item.id,
          JSON.stringify(item)
        )
        return item
      },
      async remove(userId, id) {
        run('delete from fridge_item where user_id = ? and id = ?', userId, id)
      },
    },

    nutritionPlanCache: {
      async get(userId, cacheKey) {
        const data = getOne(
          'select data from nutrition_plan_cache where user_id = ? and cache_key = ?',
          userId,
          cacheKey
        )
        return data ? parse<NutritionPlan>(data) : null
      },
      async upsert(userId, cacheKey, plan) {
        run(
          `insert into nutrition_plan_cache (user_id, cache_key, data) values (?, ?, ?)
           on conflict (user_id, cache_key) do update set data = excluded.data`,
          userId,
          cacheKey,
          JSON.stringify(plan)
        )
      },
    },

    reminders: {
      async get(userId) {
        const data = getOne(
          'select data from reminder_preference where user_id = ?',
          userId
        )
        return data ? parse<ReminderPreference>(data) : null
      },
      async upsert(userId, pref) {
        run(
          `insert into reminder_preference (user_id, data) values (?, ?)
           on conflict (user_id) do update set data = excluded.data`,
          userId,
          JSON.stringify(pref)
        )
        return pref
      },
    },

    reports: {
      async list(userId) {
        return getAll(
          'select data from health_report where user_id = ? order by created_at desc, id desc',
          userId
        ).map((data) => parse<HealthReport>(data))
      },
      async get(userId, id) {
        const data = getOne(
          'select data from health_report where user_id = ? and id = ?',
          userId,
          id
        )
        return data ? parse<HealthReport>(data) : null
      },
      async upsert(userId, report) {
        run(
          `insert into health_report (user_id, id, created_at, data) values (?, ?, ?, ?)
           on conflict (user_id, id) do update set
             created_at = excluded.created_at,
             data = excluded.data`,
          userId,
          report.id,
          report.createdAt,
          JSON.stringify(report)
        )
        return report
      },
      async remove(userId, id) {
        run(
          'delete from health_report where user_id = ? and id = ?',
          userId,
          id
        )
        run(
          'delete from report_recommendation_cache where user_id = ? and report_id = ?',
          userId,
          id
        )
      },
    },

    reportRecommendationCache: {
      async get(userId, cacheKey) {
        const data = getOne(
          'select data from report_recommendation_cache where user_id = ? and cache_key = ?',
          userId,
          cacheKey
        )
        return data ? parse<HealthRecommendationSet>(data) : null
      },
      async upsert(userId, cacheKey, recommendations) {
        run(
          `insert into report_recommendation_cache (user_id, cache_key, report_id, data)
           values (?, ?, ?, ?)
           on conflict (user_id, cache_key) do update set
             report_id = excluded.report_id,
             data = excluded.data`,
          userId,
          cacheKey,
          recommendations.reportId,
          JSON.stringify(recommendations)
        )
      },
      async removeByReport(userId, reportId) {
        run(
          'delete from report_recommendation_cache where user_id = ? and report_id = ?',
          userId,
          reportId
        )
      },
    },

    contextNotes: {
      async list(userId, date) {
        return getAll(
          `select data from context_note
           where user_id = ? and date = ?
           order by created_at asc, id asc`,
          userId,
          date
        ).map((data) => parse<ContextNote>(data))
      },
      async append(userId, note) {
        run(
          `insert into context_note (user_id, id, date, created_at, data)
           values (?, ?, ?, ?, ?)
           on conflict (user_id, id) do update set data = excluded.data`,
          userId,
          note.id,
          note.date,
          note.createdAt,
          JSON.stringify(note)
        )
        return note
      },
    },
  }
}
