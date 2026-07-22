import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Button } from '@/components/ui/buttons'
import { Screen } from '@/components/ui/screen'
import { isAccountSyncAvailable } from '@/services'
import {
  AccountAuthError,
  getAccountStatus,
  requestEmailCode,
  signOutAccount,
  verifyEmailCode,
  type AccountStatus,
  type EmailCodePurpose,
} from '@/services/supabase-client'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

export default function Account() {
  const { profile, reloadProfile } = useAppState()
  const available = isAccountSyncAvailable()
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [purpose, setPurpose] = useState<EmailCodePurpose | null>(null)
  const [loading, setLoading] = useState(available)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!available) return
    let active = true
    getAccountStatus()
      .then((value) => active && setStatus(value))
      .catch(() => active && setError('Could not load your account. Please try again.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [available])

  const messageFor = (cause: unknown) =>
    cause instanceof AccountAuthError ? cause.message : 'Something went wrong. Please try again.'

  const sendCode = async () => {
    setLoading(true)
    setError(null)
    try {
      setPurpose(await requestEmailCode(email))
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async () => {
    if (!purpose) return
    setLoading(true)
    setError(null)
    try {
      const verifiedStatus = await verifyEmailCode(email, code, purpose)
      setStatus(verifiedStatus)
      const restoredProfile = await reloadProfile()
      if (restoredProfile === undefined) {
        throw new AccountAuthError('Signed in, but your profile could not be loaded. Try again.')
      }
      router.replace(restoredProfile ? '/(tabs)' : '/welcome')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)
    try {
      await signOutAccount()
      setStatus({ email: null, isAnonymous: true })
      const restoredProfile = await reloadProfile()
      if (restoredProfile === undefined) {
        throw new AccountAuthError('Signed out, but the new local profile could not be loaded.')
      }
      router.replace('/welcome')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>AKESO ACCOUNT</Text>
        <View style={styles.topSpacer} />
      </View>

      <Text style={styles.kicker}>KEEP YOUR PROGRESS</Text>
      <Text style={type.h1}>Your Akeso, wherever you sign in.</Text>
      <Text style={styles.subtitle}>
        Use a one-time email code. No password to create or remember.
      </Text>

      {!available ? (
        <View style={styles.card}>
          <Ionicons name="cloud-offline" size={28} color={colors.text} />
          <Text style={styles.cardTitle}>Account sync is not configured</Text>
          <Text style={styles.cardCopy}>
            This browser will remember your profile, but cross-device sign-in needs the production
            API and Supabase environment variables.
          </Text>
        </View>
      ) : loading && !status ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.cardCopy}>Checking your account…</Text>
        </View>
      ) : status && !status.isAnonymous ? (
        <View style={styles.card}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={24} color={colors.text} />
          </View>
          <Text style={styles.cardTitle}>Progress is protected</Text>
          <Text style={styles.cardCopy}>{status.email}</Text>
          <Button label="Sign out on this device" variant="ghost" loading={loading} onPress={signOut} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {profile ? 'Save your current progress' : 'Sign in to your existing Akeso'}
          </Text>
          <Text style={styles.cardCopy}>
            We will send a six-digit code. If this email already has an account, its saved profile
            will be restored after verification.
          </Text>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!purpose && !loading}
            inputMode="email"
            keyboardType="email-address"
            maxLength={254}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
          />

          {purpose ? (
            <>
              <Text style={styles.sent}>Code sent. Check your inbox and spam folder.</Text>
              <Text style={styles.label}>6-DIGIT CODE</Text>
              <TextInput
                autoComplete="one-time-code"
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.codeInput]}
                value={code}
              />
              <Button
                disabled={code.length !== 6}
                label="Verify and continue"
                loading={loading}
                onPress={confirmCode}
              />
              <Button
                label="Use a different email"
                variant="ghost"
                onPress={() => {
                  setPurpose(null)
                  setCode('')
                  setError(null)
                }}
              />
            </>
          ) : (
            <Button label="Email me a code" loading={loading} onPress={sendCode} />
          )}
        </View>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(7),
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  topTitle: { ...type.label, color: colors.text },
  topSpacer: { width: 44 },
  pressed: { transform: [{ translateY: 2 }] },
  kicker: { ...type.label, color: colors.primaryDark, marginBottom: sp(1.5) },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: sp(2), marginBottom: sp(6) },
  card: {
    gap: sp(3),
    padding: sp(4),
    backgroundColor: colors.surface,
    borderColor: colors.text,
    borderWidth: 1.5,
    borderRadius: radius.xl,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cardCopy: { ...type.small, color: colors.textSecondary },
  label: { ...type.label, color: colors.textSecondary, marginTop: sp(1) },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: sp(3.5),
  },
  codeInput: { fontSize: 22, fontWeight: '900', letterSpacing: 8 },
  sent: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    borderColor: colors.text,
    borderWidth: 1.5,
  },
  loadingRow: { alignItems: 'center', gap: sp(2), paddingVertical: sp(8) },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: sp(3) },
})
