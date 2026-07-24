import { env } from '../env'
import { createMemoryRepos } from './memory'
import { createSqliteRepos } from './sqlite'
import { createSupabaseRepos } from './supabase'
import type { Repos } from './types'

export type { Repos } from './types'

export function createRepos(): Repos {
  switch (env.repoDriver) {
    case 'memory':
      return createMemoryRepos()
    case 'sqlite':
      return createSqliteRepos()
    default:
      return createSupabaseRepos()
  }
}
