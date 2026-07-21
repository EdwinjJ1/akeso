import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import type {
  CoachReply,
  DayPlan,
  EnergyResult,
  PlanBlock,
  UpdatePlanBlockInput,
} from '@akeso/domain'

import { CoachCard } from '@/components/coach-card'
import { Mascot } from '@/components/mascot'
import { PlanBlockCard } from '@/components/plan/plan-block-card'
import { PlanBlockUpdateSheet } from '@/components/plan/plan-block-update-sheet'
import { Button } from '@/components/ui/buttons'
import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { SectionHeader } from '@/components/ui/section-header'
import { Reveal } from '@/components/ui/reveal'
import { useAppState } from '@/state/app-state'
import { colors, sp, type } from '@/theme/tokens'
import { todayLabel } from '@/utils/dates'

export default function Plan() {
  const {
    energy,
    plan,
    coach,
    loading,
    error,
    refreshToday,
    regeneratePlan,
    updatePlanBlock,
  } = useAppState()

  useEffect(() => {
    void refreshToday()
  }, [refreshToday])

  return (
    <PlanView
      energy={energy}
      plan={plan}
      coach={coach}
      loading={loading}
      error={error}
      onRefresh={refreshToday}
      onRegenerate={() => regeneratePlan()}
      onUpdateBlock={updatePlanBlock}
    />
  )
}

interface PlanViewProps {
  energy: EnergyResult | null
  plan: DayPlan | null
  coach: CoachReply | null
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
  onRegenerate: () => Promise<void>
  onUpdateBlock: (
    blockId: string,
    input: UpdatePlanBlockInput
  ) => Promise<void>
}

export function PlanView({
  energy,
  plan,
  coach,
  loading,
  error,
  onRefresh,
  onRegenerate,
  onUpdateBlock,
}: PlanViewProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<PlanBlock | null>(null)

  const regenerate = async () => {
    setRegenerating(true)
    setRegenerateError(null)
    try {
      await onRegenerate()
    } catch {
      setRegenerateError('Couldn’t regenerate suggestions. Please retry.')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading && !plan) {
    return (
      <Screen tabbed>
        <SectionHeader title="Today’s plan" subtitle={todayLabel()} />
        <View style={styles.loading}>
          <Mascot state="steady" size={120} />
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>Reading today’s plan…</Text>
        </View>
      </Screen>
    )
  }

  if (error && !plan) {
    return (
      <Screen tabbed>
        <SectionHeader title="Today’s plan" subtitle={todayLabel()} />
        <Card tone="coral" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Couldn’t load today’s plan</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Button label="Retry" onPress={() => void onRefresh()} variant="cta" />
        </Card>
      </Screen>
    )
  }

  if (!energy) {
    return (
      <Screen tabbed>
        <SectionHeader title="Today’s plan" subtitle={todayLabel()} />
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={26} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>Your plan is waiting</Text>
          <Text style={styles.emptyText}>
            Check in first so Akeso knows today’s energy — then it schedules your
            hardest work into your best hours.
          </Text>
          <Button label="Start check-in" onPress={() => router.push('/checkin')} variant="cta" />
        </Card>
      </Screen>
    )
  }

  if (!plan || plan.blocks.length === 0) {
    return (
      <Screen tabbed>
        <SectionHeader title="Today’s plan" subtitle={todayLabel()} />
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sparkles-outline" size={26} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>No suggestions yet</Text>
          <Text style={styles.emptyText}>
            Akeso can rebuild a light, energy-matched set of suggestions for today.
          </Text>
          <Button
            label="Regenerate suggestions"
            onPress={regenerate}
            loading={regenerating}
            variant="cta"
          />
          {regenerateError ? (
            <Text style={styles.inlineError}>{regenerateError}</Text>
          ) : null}
        </Card>
      </Screen>
    )
  }

  return (
    <Screen tabbed>
      <Reveal>
        <View style={styles.planHero}>
          <View style={styles.planHeroCopy}>
            <Text style={styles.heroKicker}>{todayLabel()}</Text>
            <Text style={styles.heroTitle}>YOUR DAY,{`\n`}IN RHYTHM.</Text>
            <Text style={styles.heroSubtitle}>Hard things when you’re sharp. Space when you’re not.</Text>
          </View>
          <View style={styles.heroMascot}><Mascot state="steady" size={150} /></View>
        </View>
      </Reveal>

      <Reveal delay={70}>
      <Card tone="yellow" style={styles.noteCard}>
        <Ionicons name="sparkles" size={16} color={colors.primaryDark} />
        <Text style={styles.noteText}>{plan.coachNote}</Text>
      </Card>
      </Reveal>

      <Reveal delay={130} style={styles.timeline}>
        {plan.blocks.map((block, index) => (
          <PlanBlockCard
            key={block.id}
            block={block}
            isLast={index === plan.blocks.length - 1}
            onUpdate={() => setSelectedBlock(block)}
          />
        ))}
      </Reveal>

      <View style={styles.regenerateWrap}>
      <Button
        label="Regenerate suggestions"
        onPress={regenerate}
        loading={regenerating}
        variant="ghost"
      />
      {regenerateError ? (
        <Text style={styles.inlineError}>{regenerateError}</Text>
      ) : null}
      </View>

      {coach ? <CoachCard coach={coach} /> : null}

      <PlanBlockUpdateSheet
        visible={selectedBlock !== null}
        block={selectedBlock}
        blocks={plan.blocks}
        onClose={() => setSelectedBlock(null)}
        onSave={(input) => {
          if (!selectedBlock) return Promise.resolve()
          return onUpdateBlock(selectedBlock.id, input)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  planHero: {
    minHeight: 250,
    backgroundColor: colors.text,
    borderRadius: 32,
    borderTopRightRadius: 7,
    marginBottom: sp(5),
    overflow: 'hidden',
    padding: sp(5),
  },
  planHeroCopy: { width: '68%', zIndex: 2 },
  heroKicker: { ...type.label, color: colors.lime, marginBottom: sp(3) },
  heroTitle: { fontSize: 37, lineHeight: 37, fontWeight: '900', color: colors.surface, letterSpacing: -1.5 },
  heroSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#C9CCC1', marginTop: sp(3) },
  heroMascot: { position: 'absolute', right: -20, bottom: -14 },
  emptyCard: {
    alignItems: 'stretch',
    paddingVertical: sp(7),
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: sp(4),
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: sp(2),
    marginBottom: sp(5),
  },
  loading: { paddingVertical: sp(10), alignItems: 'center', gap: sp(2) },
  loadingText: { ...type.small, color: colors.text },
  inlineError: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: sp(2),
    textAlign: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(2.5),
    padding: sp(4),
  },
  noteText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    flex: 1,
  },
  timeline: {
    marginBottom: sp(4),
  },
  regenerateWrap: { marginBottom: sp(3) },
})
