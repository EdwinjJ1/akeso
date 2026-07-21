import { env } from '../env'
import { createMemoryRepos } from './memory'
import { createSupabaseRepos } from './supabase'
import type { Repos } from './types'

export type { Repos } from './types'

export function createRepos(): Repos {
  return env.demoMode ? createMemoryRepos() : createSupabaseRepos()
}
