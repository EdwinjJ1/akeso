import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Config comes from EXPO_PUBLIC_* vars, which Expo inlines into the client
 * bundle at build time — the only kind of env var safe to read here. Never
 * add a service-role or other server-only key under this prefix (TEAM_CONTRACT
 * §4.2: the API module must never expose it to a client).
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

let client: SupabaseClient | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function getClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}

/**
 * Akeso's MVP has no sign-in screen (single-user product, TEAM_CONTRACT
 * §9/architecture.html) — anonymous auth gives every install a real,
 * persisted `auth.uid()` so the API's per-user RLS still applies, without
 * building a login flow nobody asked for. The session (and so the anonymous
 * identity) persists in AsyncStorage across restarts.
 */
async function ensureSession() {
  const supabase = getClient()
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error || !signInData.session) {
    throw new Error(`Could not start an anonymous session: ${error?.message ?? 'unknown error'}`)
  }
  return signInData.session
}

/** Resolves once the anonymous (or real, once that ships) session is ready. */
export async function getAccessToken(): Promise<string> {
  const session = await ensureSession()
  return session.access_token
}
