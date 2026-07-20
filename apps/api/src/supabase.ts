import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from './env'

let client: SupabaseClient | undefined

const FETCH_TIMEOUT_MS = 10_000

/**
 * Without this, a hung upstream (Supabase down, network partition) would
 * hang every request that touches the database or auth.getUser() forever —
 * there's no other timeout anywhere in this stack.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal
  return fetch(input, { ...init, signal })
}

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
      global: { fetch: fetchWithTimeout },
    })
  }
  return client
}
