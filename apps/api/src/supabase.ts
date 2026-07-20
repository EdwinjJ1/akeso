import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from './env'

let client: SupabaseClient | undefined

/**
 * Lazily-created service-role client. Only ever called when
 * env.supabase is set (demoMode === false) — see repos/index.ts.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!env.supabase) {
    throw new Error('getSupabaseClient() called without Supabase configured')
  }
  if (!client) {
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    })
  }
  return client
}
