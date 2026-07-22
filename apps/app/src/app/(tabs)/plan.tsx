import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CoachCard } from '@/components/coach-card'
import { Mascot } from '@/components/mascot'
import { PlanBlockCard } from '@/components/plan/plan-block-card'
import { TaskRow } from '@/components/plan/task-row'
import { Button } from '@/components/ui/buttons'
import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { SectionHeader } from '@/components/ui/section-header'
import { Reveal } from '@/components/ui/reveal'
import { useAppState } from '@/state/app-state'
import { colors, sp, type } from '@/theme/tokens'
import { todayISO, todayLabel } from '@/utils/dates'

export default function Plan() {
  const {
    energy,
    plan,
    tasks,
    coach,
    planLoading,
    planError,
    refreshToday,
    regeneratePlan,
  } = useAppState()
  const [regenerating, setRegenerating] = useState(false)
  const today = todayISO()
  const todayEnergy = energy?.date === today ? energy : null
  const todayPlan = plan?.date === today ? plan : null

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await regeneratePlan()
    } finally {
      setRegenerating(false)
    }
  }

  if (!todayEnergy) {
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

  if (!todayPlan) {
    return (
      <Screen tabbed>
        <SectionHeader title="Today's plan" subtitle={todayLabel()} />
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>
            {planLoading ? 'Loading your plan' : "Today's plan is unavailable"}
          </Text>
          <Text style={styles.emptyText}>
            {planLoading
              ? 'Your energy result is ready. We are still matching tasks to your best hours.'
              : planError ?? 'Your energy result is safe. Try loading the plan again.'}
          </Text>
          <Button
            label={planLoading ? 'Loading plan…' : 'Retry plan'}
            onPress={refreshToday}
            disabled={planLoading}
            variant="cta"
          />
        </Card>
      </Screen>
    )
  }

  const unscheduled = tasks.filter((task) => task.status === 'todo')
  const scheduled = tasks.filter((task) => task.status !== 'todo')

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
        <Text style={styles.noteText}>{todayPlan.coachNote}</Text>
      </Card>
      </Reveal>

      <Reveal delay={130} style={styles.timeline}>
        {todayPlan.blocks.map((block, index) => (
          <PlanBlockCard
            key={block.id}
            block={block}
            isLast={index === todayPlan.blocks.length - 1}
          />
        ))}
      </Reveal>

      <View style={styles.regenerateWrap}>
      <Button
        label="Regenerate with coach"
        onPress={regenerate}
        loading={regenerating}
        variant="ghost"
      />
      </View>

      <View style={styles.tasksSection}>
        <Text style={type.h2}>Tasks</Text>
        <Card tone="quiet" style={styles.tasksCard}>
          {scheduled.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {unscheduled.length > 0 ? (
            <>
              <Text style={styles.unscheduledLabel}>Not scheduled today</Text>
              {unscheduled.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </>
          ) : null}
        </Card>
      </View>

      {coach ? <CoachCard coach={coach} /> : null}
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
  tasksSection: {
    marginTop: sp(6),
  },
  tasksCard: {
    marginTop: sp(3),
  },
  unscheduledLabel: {
    ...type.label,
    marginTop: sp(3),
    marginBottom: sp(1),
  },
})
