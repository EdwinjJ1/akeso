import type { CoachReply, DayPlan, EnergyResult, NutritionPlan } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { CoachCard } from '@/components/coach-card'
import { EnergyCurve } from '@/components/energy/energy-curve'
import { FactorRow } from '@/components/energy/factor-row'
import { CheckInPrompt } from '@/components/home/checkin-prompt'
import { NutritionSnapshot } from '@/components/home/nutrition-snapshot'
import { ReminderCard } from '@/components/home/reminder-card'
import { Mascot, type MascotState } from '@/components/mascot'
import { Button } from '@/components/ui/buttons'
import { Card } from '@/components/ui/card'
import { Tag } from '@/components/ui/chips'
import { Reveal } from '@/components/ui/reveal'
import { Screen } from '@/components/ui/screen'
import { useAppState } from '@/state/app-state'
import { deriveDashboardState } from '@/state/dashboard-state'
import { colors, sp, type } from '@/theme/tokens'
import { formatHour, greetingForNow, todayISO, todayLabel } from '@/utils/dates'

export default function Dashboard() {
  const {
    profile,
    energy,
    latestCheckIn,
    plan,
    nutrition,
    coach,
    loading,
    error,
    ancillaryDate,
    planLoading,
    planError,
    coachLoading,
    coachError,
    refreshToday,
  } = useAppState()

  useEffect(() => {
    refreshToday()
  }, [refreshToday])

  const today = todayISO()
  const dashboard = deriveDashboardState({ energy, today, loading, error })
  const hasTodayCheckIn = latestCheckIn?.date === today
  const promptMode = hasTodayCheckIn ? 'daily' : 'first'

  return (
    <Screen tabbed>
      <Reveal>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{todayLabel()}</Text>
            <Text style={type.h1}>{greetingForNow(profile?.displayName)}</Text>
          </View>
          <Pressable
            accessibilityHint="Opens your profile and settings"
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push('../profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          >
            <Text style={styles.avatarText}>
              {(profile?.displayName ?? 'A').slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </Reveal>

      <Reveal delay={30}>
        <ReminderCard />
      </Reveal>

      {dashboard.status === 'loading' ? (
        <View style={styles.loading}>
          <Mascot state="steady" size={128} />
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>{"Reading today's rhythm..."}</Text>
        </View>
      ) : null}

      {dashboard.status === 'error' ? (
        <Card tone="coral">
          <Text style={styles.errorTitle}>Something went sideways</Text>
          <Text style={styles.errorText}>{dashboard.message}</Text>
          <View style={styles.retryWrap}>
            <Button label="Retry" onPress={() => refreshToday()} />
          </View>
        </Card>
      ) : null}

      {dashboard.status === 'empty' ? <CheckInPrompt mode={promptMode} /> : null}

      {dashboard.status === 'ready' ? (
        <ReadyDashboard
          energy={dashboard.energy}
          warning={dashboard.warning}
          plan={plan?.date === today ? plan : null}
          planLoading={planLoading}
          planError={planError}
          nutrition={nutrition?.date === today ? nutrition : null}
          coach={ancillaryDate === today ? coach : null}
          coachLoading={coachLoading}
          coachError={coachError}
          onRetry={refreshToday}
        />
      ) : null}
    </Screen>
  )
}

type ReadyDashboardProps = {
  energy: EnergyResult
  warning: string | null
  plan: DayPlan | null
  planLoading: boolean
  planError: string | null
  nutrition: NutritionPlan | null
  coach: CoachReply | null
  coachLoading: boolean
  coachError: string | null
  onRetry: () => Promise<void>
}

function ReadyDashboard({
  energy,
  warning,
  plan,
  planLoading,
  planError,
  nutrition,
  coach,
  coachLoading,
  coachError,
  onRetry,
}: ReadyDashboardProps) {
  const mascotState: MascotState =
    energy.band === 'high' ? 'high' : energy.band === 'low' ? 'low' : 'steady'
  const peakLabel = `Peak ${formatHour(energy.peakWindow.startHour)}–${formatHour(
    energy.peakWindow.endHour
  )}`
  const resetLabel = `Reset ${formatHour(energy.dipWindow.startHour)}–${formatHour(
    energy.dipWindow.endHour
  )}`

  return (
    <>
      {warning ? (
        <Card tone="coral" style={styles.warningCard}>
          <Text style={styles.warningTitle}>Showing your last saved result</Text>
          <Text style={styles.warningText}>{warning}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.warningAction}>Try again</Text>
          </Pressable>
        </Card>
      ) : null}

      <Reveal delay={60}>
        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <View style={styles.scoreLine}>
              <Text style={styles.score}>{energy.score}</Text>
              <Text style={styles.scoreUnit}>/ 100</Text>
            </View>
            <Text style={styles.band}>
              {energy.band === 'moderate' ? 'STEADY' : energy.band.toUpperCase()} ENERGY
            </Text>
            {/* Peak/Reset sit in the hero so Score, Band and Peak Focus all
                land on the first screen, at one visual level. */}
            <View style={styles.heroWindows}>
              <Tag label={peakLabel} color={colors.text} background={colors.lime} />
              <Tag label={resetLabel} color={colors.text} background={colors.coral} />
            </View>
            <Text style={styles.headline}>{energy.headline}</Text>
            <Pressable
              onPress={() => router.push('/checkin')}
              style={({ pressed }) => [styles.updateLink, pressed && styles.updatePressed]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={15} color={colors.text} />
              <Text style={styles.updateText}>Update check-in</Text>
            </Pressable>
          </View>
          <View style={styles.mascotWrap}>
            <Mascot state={mascotState} size={190} />
          </View>
          <View style={styles.heroSticker}>
            <Text style={styles.heroStickerText}>TODAY</Text>
          </View>
        </View>
      </Reveal>

      <Reveal delay={90}>
        <View style={styles.planCta}>
          <Button
            label={
              plan
                ? "View today's plan"
                : planLoading
                  ? "Loading today's plan…"
                  : planError
                    ? "Retry today's plan"
                    : "Load today's plan"
            }
            onPress={plan ? () => router.push('/plan') : onRetry}
            disabled={planLoading}
            variant="cta"
          />
          {!planLoading && !plan && planError ? (
            <Text style={styles.moduleError}>{planError}</Text>
          ) : null}
        </View>
      </Reveal>

      <Reveal delay={120}>
        <Card tone="yellow" style={styles.rhythmCard}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionKicker}>ENERGY MAP</Text>
              <Text style={type.h2}>Your rhythm</Text>
            </View>
            <Ionicons name="analytics" size={24} color={colors.text} />
          </View>
          <EnergyCurve
            curve={energy.curve}
            peakWindow={energy.peakWindow}
            dipWindow={energy.dipWindow}
          />
        </Card>
      </Reveal>

      <Reveal delay={180}>
        <Card style={styles.factorCard}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionKicker}>THE RECEIPT</Text>
              <Text style={type.h2}>Why this score</Text>
            </View>
            <Text style={styles.factorCount}>{energy.factors.length}</Text>
          </View>
          <View style={styles.factorList}>
            {energy.factors.map((factor) => (
              <FactorRow key={factor.key} factor={factor} />
            ))}
          </View>
        </Card>
      </Reveal>

      {nutrition ? (
        <Reveal delay={240}>
          <NutritionSnapshot nutrition={nutrition} />
        </Reveal>
      ) : null}

      {coach ? (
        <Reveal delay={300}>
          <CoachCard coach={coach} compact />
        </Reveal>
      ) : coachLoading ? (
        <Card tone="ink" style={styles.coachLoadingCard}>
          <ActivityIndicator color={colors.lime} />
          <Text style={styles.coachLoadingText}>Preparing one evidence-based next step…</Text>
        </Card>
      ) : (
        <Card tone="ink" style={styles.fallbackCard}>
          <Text style={styles.fallbackKicker}>A SAFE NEXT STEP</Text>
          <Text style={styles.fallbackTitle}>Protect your peak focus window</Text>
          <Text style={styles.fallbackText}>
            Put your most demanding task between {formatHour(energy.peakWindow.startHour)} and{' '}
            {formatHour(energy.peakWindow.endHour)}. This uses today's energy curve while the
            coaching note is unavailable.
          </Text>
          {coachError ? <Text style={styles.fallbackError}>{coachError}</Text> : null}
        </Card>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(5),
  },
  eyebrow: { ...type.label, marginBottom: sp(1) },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.text,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '3deg' }],
  },
  avatarText: { color: colors.lime, fontSize: 17, fontWeight: '900' },
  avatarPressed: { transform: [{ rotate: '3deg' }, { translateY: 2 }] },
  loading: { paddingVertical: sp(10), alignItems: 'center', gap: sp(2) },
  loadingText: { ...type.small, color: colors.text },
  errorTitle: { ...type.h2, color: colors.text, marginBottom: sp(1) },
  errorText: { ...type.body, color: colors.text, fontWeight: '700' },
  retryWrap: { marginTop: sp(4), alignSelf: 'flex-start' },
  warningCard: { marginBottom: sp(4) },
  warningTitle: { ...type.h3, marginBottom: sp(1) },
  warningText: { ...type.small, color: colors.text },
  warningAction: { ...type.label, color: colors.text, marginTop: sp(2) },
  heroCard: {
    minHeight: 320,
    borderRadius: 36,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.text,
    overflow: 'hidden',
    marginBottom: sp(5),
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 7 },
  },
  heroCopy: { padding: sp(5), width: '65%', zIndex: 2 },
  scoreLine: { flexDirection: 'row', alignItems: 'flex-end' },
  score: { fontSize: 74, lineHeight: 78, fontWeight: '900', letterSpacing: -4, color: colors.text },
  scoreUnit: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: sp(2) },
  band: { ...type.label, color: colors.text, marginBottom: sp(3) },
  heroWindows: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginBottom: sp(3) },
  headline: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: colors.text },
  planCta: { marginBottom: sp(5) },
  moduleError: { ...type.small, color: colors.danger, marginTop: sp(2), textAlign: 'center' },
  updateLink: {
    marginTop: sp(4),
    flexDirection: 'row',
    gap: sp(1.5),
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: sp(2),
    paddingHorizontal: sp(3),
    borderRadius: 999,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  updatePressed: { transform: [{ translateY: 2 }] },
  updateText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  mascotWrap: { position: 'absolute', right: -24, bottom: -16, zIndex: 1 },
  heroSticker: {
    position: 'absolute',
    right: 14,
    top: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: sp(2.5),
    paddingVertical: sp(1.5),
    borderRadius: 8,
    transform: [{ rotate: '4deg' }],
  },
  heroStickerText: { ...type.label, color: colors.text },
  rhythmCard: { borderTopLeftRadius: 8, borderBottomRightRadius: 38 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionKicker: { ...type.label, color: colors.text, marginBottom: sp(1) },
  factorCard: { borderTopRightRadius: 8 },
  factorCount: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.text,
    color: colors.lime,
    textAlign: 'center',
    lineHeight: 36,
    fontWeight: '900',
  },
  factorList: { marginTop: sp(3) },
  coachLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
  },
  coachLoadingText: { ...type.small, color: colors.textOnColor, flex: 1 },
  fallbackCard: { borderBottomRightRadius: 8 },
  fallbackKicker: { ...type.label, color: colors.lime, marginBottom: sp(2) },
  fallbackTitle: { ...type.h3, color: colors.textOnColor },
  fallbackText: { ...type.body, color: colors.textOnColor, marginTop: sp(2) },
  fallbackError: { ...type.small, color: colors.coral, marginTop: sp(3) },
})
