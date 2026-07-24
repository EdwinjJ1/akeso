import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

export type EmailCodePurpose = 'link' | 'sign-in'

export interface AccountStatus {
  email: string | null
  isAnonymous: boolean
}

export class AccountAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountAuthError'
  }
}

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
        // On web the OAuth (Google) redirect lands back on the app with a
        // PKCE code in the URL; supabase-js must parse it to finish sign-in.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  }
  return client
}

function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountAuthError('Enter a valid email address.')
  }
  return email
}

function normalizedCode(value: string): string {
  const code = value.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) {
    throw new AccountAuthError('Enter the 6-digit code from your email.')
  }
  return code
}

function isExistingIdentityError(code: string | undefined): boolean {
  return (
    code === 'email_exists' ||
    code === 'identity_already_exists' ||
    code === 'user_already_exists'
  )
}

/**
 * In-flight anonymous sign-in, shared by concurrent callers. Without this,
 * the App's parallel refreshToday() (five service calls at once) would each
 * find no session and fire its own signInAnonymously(), creating several
 * anonymous users and splitting one day's reads and writes across different
 * auth.uid()s. Cleared once settled so a failed attempt can be retried.
 */
let pendingSignIn: Promise<Session> | undefined

/**
 * Anonymous auth gives every install a real, persisted `auth.uid()` so the
 * API's per-user RLS applies before the user chooses to link an email. The
 * session persists in AsyncStorage across restarts; the Account screen can
 * later upgrade it in place for cross-device recovery.
 */
async function ensureSession(): Promise<Session> {
  const supabase = getClient()
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  if (!pendingSignIn) {
    pendingSignIn = (async () => {
      const { data: signInData, error } = await supabase.auth.signInAnonymously()
      if (error || !signInData.session) {
        throw new Error(
          `Could not start an anonymous session: ${error?.message ?? 'unknown error'}`
        )
      }
      return signInData.session
    })().finally(() => {
      pendingSignIn = undefined
    })
  }
  return pendingSignIn
}

/** Resolves once the anonymous or email-linked session is ready. */
export async function getAccessToken(): Promise<string> {
  const session = await ensureSession()
  return session.access_token
}

export async function getAccountStatus(): Promise<AccountStatus> {
  const session = await ensureSession()
  return {
    email: session.user.email ?? null,
    isAnonymous: session.user.is_anonymous === true,
  }
}

/**
 * An anonymous user is upgraded in place so their auth.uid() — and all data
 * keyed to it — stays unchanged. If the address already belongs to an Akeso
 * account, request a sign-in OTP instead. The UI deliberately presents the
 * same response for both paths to avoid exposing whether an email is registered.
 */
export async function requestEmailCode(value: string): Promise<EmailCodePurpose> {
  const email = normalizedEmail(value)
  const supabase = getClient()
  const session = await ensureSession()

  if (!session.user.is_anonymous) {
    throw new AccountAuthError('This Akeso is already linked to an account.')
  }

  const { error: linkError } = await supabase.auth.updateUser({ email })
  if (!linkError) return 'link'

  if (!isExistingIdentityError(linkError.code)) {
    throw new AccountAuthError('We could not send a code. Please try again shortly.')
  }

  const { error: signInError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (signInError) {
    throw new AccountAuthError('We could not send a code. Please try again shortly.')
  }
  return 'sign-in'
}

export async function verifyEmailCode(
  value: string,
  tokenValue: string,
  purpose: EmailCodePurpose
): Promise<AccountStatus> {
  const email = normalizedEmail(value)
  const token = normalizedCode(tokenValue)
  const { data, error } = await getClient().auth.verifyOtp({
    email,
    token,
    type: purpose === 'link' ? 'email_change' : 'email',
  })
  if (error || !data.user) {
    throw new AccountAuthError('That code is invalid or has expired. Request a new one.')
  }
  return {
    email: data.user.email ?? email,
    isAnonymous: data.user.is_anonymous === true,
  }
}

/**
 * Google sign-in via Supabase OAuth (web only — the flow is a full-page
 * redirect). An anonymous session is upgraded in place with linkIdentity so
 * auth.uid() — and every row keyed to it — survives the upgrade; if manual
 * linking is disabled on the project this falls back to a fresh Google
 * session. Requires the Google provider to be enabled in the Supabase
 * dashboard; until then the returned error message surfaces in the UI.
 */
export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new AccountAuthError('Google sign-in is currently available in the web app.')
  }
  const supabase = getClient()
  const redirectTo = window.location.origin

  const { data } = await supabase.auth.getSession()
  if (data.session?.user.is_anonymous) {
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo },
    })
    if (!linkError) return
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) {
    throw new AccountAuthError(
      'Could not start Google sign-in. Check that the Google provider is enabled, then try again.'
    )
  }
}

export async function signOutAccount(): Promise<void> {
  const { error } = await getClient().auth.signOut({ scope: 'local' })
  if (error) throw new AccountAuthError('Could not sign out. Please try again.')
  await ensureSession()
}
