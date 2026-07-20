import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { CoachCard } from '@/components/coach-card'
import { EnergyCurve } from '@/components/energy/energy-curve'
import { FactorRow } from '@/components/energy/factor-row'
import { CheckInPrompt } from '@/components/home/checkin-prompt'
import { NutritionSnapshot } from '@/components/home/nutrition-snapshot'
import { Mascot, type MascotState } from '@/components/mascot'
import { Card } from '@/components/ui/card'
import { Tag } from '@/components/ui/chips'
import { Reveal } from '@/components/ui/reveal'
import { Screen } from '@/components/ui/screen'
import { useAppState } from '@/state/app-state'
import { colors, sp, type } from '@/theme/tokens'
import { formatHour, greetingForNow, todayLabel } from '@/utils/dates'

export default function Dashboard() {
  const { profile, energy, latestCheckIn, nutrition, coach, loading, error, refreshToday } = useAppState()

  useEffect(() => {
    refreshToday()
  }, [refreshToday])

  const mascotState: MascotState =
    energy?.band === 'high' ? 'high' : energy?.band === 'low' ? 'low' : 'steady'

  return (
    <Screen tabbed>
      <Reveal>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{todayLabel()}</Text>
            <Text style={type.h1}>{greetingForNow(profile?.displayName)}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.displayName ?? 'A').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>
      </Reveal>

      {loading && !energy ? (
        <View style={styles.loading}>
          <Mascot state="steady" size={128} />
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>Reading today’s rhythm…</Text>
        </View>
      ) : null}

      {error ? (
        <Card tone="coral">
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!loading && !energy ? <CheckInPrompt mode={latestCheckIn ? 'daily' : 'first'} /> : null}

      {energy ? (
        <>
          <Reveal delay={60}>
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <View style={styles.scoreLine}>
                  <Text style={styles.score}>{energy.score}</Text>
                  <Text style={styles.scoreUnit}>/ 100</Text>
                </View>
                <Text style={styles.band}>{energy.band === 'moderate' ? 'STEADY' : energy.band.toUpperCase()} ENERGY</Text>
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

          <Reveal delay={120}>
            <Card tone="yellow" style={styles.rhythmCard}>
              <View style={styles.sectionTitleRow}>
                <View>
                  <Text style={styles.sectionKicker}>ENERGY MAP</Text>
                  <Text style={type.h2}>Your rhythm</Text>
                </View>
                <Ionicons name="analytics" size={24} color={colors.text} />
              </View>
              <View style={styles.windowTags}>
                <Tag
                  label={`Peak ${formatHour(energy.peakWindow.startHour)}–${formatHour(energy.peakWindow.endHour)}`}
                  color={colors.text}
                  background={colors.lime}
                />
                <Tag
                  label={`Reset ${formatHour(energy.dipWindow.startHour)}–${formatHour(energy.dipWindow.endHour)}`}
                  color={colors.text}
                  background={colors.coral}
                />
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
          ) : null}
        </>
      ) : null}
    </Screen>
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
  loading: { paddingVertical: sp(10), alignItems: 'center', gap: sp(2) },
  loadingText: { ...type.small, color: colors.text },
  errorText: { ...type.body, color: colors.text, fontWeight: '700' },
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
  headline: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: colors.text },
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
  windowTags: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2), marginVertical: sp(3) },
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
})
