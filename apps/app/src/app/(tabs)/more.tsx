import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { SectionHeader } from '@/components/ui/section-header'
import { Tag } from '@/components/ui/chips'
import { isAccountSyncAvailable } from '@/services'
import {
  allergenLabel,
  dietLabel,
  goalLabel,
} from '@/services/profile-options'
import { getAccountStatus, type AccountStatus } from '@/services/supabase-client'
import { useAppState } from '@/state/app-state'
import { colors, radius, sp, type } from '@/theme/tokens'

/**
 * The "Me" tab: the personal-data home. Everything Akeso knows about the
 * user lives behind this screen — account identity, the editable profile,
 * and uploaded health reports.
 */
export default function Me() {
  const router = useRouter()
  const { profile } = useAppState()
  const syncAvailable = isAccountSyncAvailable()
  const [account, setAccount] = useState<AccountStatus | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!syncAvailable) return
      let active = true
      getAccountStatus()
        .then((status) => active && setAccount(status))
        .catch(() => active && setAccount(null))
      return () => {
        active = false
      }
    }, [syncAvailable])
  )

  return (
    <Screen tabbed>
      <SectionHeader title="Me" subtitle="Your personal record — account, profile and health data." />

      <Card onPress={() => router.push('/account')} tone="surface" style={styles.entry}>
        <View style={[styles.icon, styles.accountIcon]}>
          <Ionicons
            name={account && !account.isAnonymous ? 'person' : 'person-outline'}
            size={22}
            color={colors.text}
          />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle}>
            {account && !account.isAnonymous ? 'Signed in' : 'Guest on this device'}
          </Text>
          <Text style={styles.entrySubtitle}>
            {account && !account.isAnonymous
              ? account.email
              : syncAvailable
                ? 'Sign in with Google or email to keep your data across devices.'
                : 'Account sync is not configured in this build.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>

      <Card onPress={() => router.push('/personal-info')} tone="surface" style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Text style={styles.entryTitle}>About you</Text>
          <View style={styles.editHint}>
            <Ionicons name="create-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.editHintText}>EDIT</Text>
          </View>
        </View>
        {profile ? (
          <>
            <ProfileRow label="Name" value={profile.displayName} />
            <ProfileRow label="Focus" value={goalLabel(profile.goal)} />
            <ProfileRow
              label="Rhythm"
              value={`${profile.typicalWake} wake · ${profile.typicalSleep} sleep`}
            />
            <ProfileRow label="Diet" value={dietLabel(profile.dietaryPreference)} />
            {profile.dietarySafety.allergens.length > 0 ? (
              <View style={styles.tagRow}>
                {profile.dietarySafety.allergens.map((allergen) => (
                  <Tag
                    key={allergen}
                    label={allergenLabel(allergen)}
                    color={colors.text}
                    background={colors.coral}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.entrySubtitle}>No profile yet — tap to set one up.</Text>
        )}
      </Card>

      <Card onPress={() => router.push('/reports')} tone="surface" style={styles.entry}>
        <View style={styles.icon}>
          <Ionicons name="document-text" size={22} color={colors.text} />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle}>Health reports</Text>
          <Text style={styles.entrySubtitle}>
            Upload a lab report, confirm the values, and get safe lifestyle suggestions.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>

      <Card onPress={() => router.push('/profile')} tone="surface" style={styles.entry}>
        <View style={[styles.icon, styles.settingsIcon]}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle}>Settings</Text>
          <Text style={styles.entrySubtitle}>Daily reminder and timezone.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>

      <Card tone="muted" style={styles.disclaimer}>
        <Ionicons name="medkit-outline" size={17} color={colors.primaryDark} />
        <Text style={styles.disclaimerText}>
          Akeso is an energy coach, not a medical device. Nothing here diagnoses a condition or
          replaces professional medical advice.
        </Text>
      </Card>
    </Screen>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: sp(3) },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIcon: { backgroundColor: colors.lime },
  settingsIcon: { backgroundColor: colors.yellow },
  entryBody: { flex: 1 },
  entryTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  entrySubtitle: { ...type.small, marginTop: 2 },
  profileCard: { gap: sp(1) },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(1),
  },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editHintText: { ...type.label, color: colors.primaryDark, fontSize: 10 },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp(1.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  profileLabel: { ...type.label, color: colors.textMuted, fontSize: 10 },
  profileValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(1.5), marginTop: sp(2) },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: sp(2.5), padding: sp(4) },
  disclaimerText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, flex: 1 },
})
