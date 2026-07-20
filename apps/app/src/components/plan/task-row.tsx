import type { Task } from '@akeso/domain'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { Tag } from '@/components/ui/chips'
import { colors, sp } from '@/theme/tokens'

const PRIORITY_STYLES: Record<Task['priority'], { label: string; color: string; background: string }> = {
  must: { label: 'Must', color: '#B91C1C', background: '#FDE3E3' },
  should: { label: 'Should', color: '#B45309', background: '#FDEDD3' },
  could: { label: 'Could', color: '#0E7490', background: '#E3F5FA' },
}

const DEMAND_LABELS: Record<Task['energyDemand'], string> = {
  high: 'needs high energy',
  medium: 'medium energy',
  low: 'low energy ok',
}

interface TaskRowProps {
  task: Task
}

export function TaskRow({ task }: TaskRowProps) {
  const priority = PRIORITY_STYLES[task.priority]
  const scheduled = task.status === 'scheduled'

  return (
    <View style={styles.row}>
      <Ionicons
        name={scheduled ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={scheduled ? colors.primaryDark : colors.borderStrong}
      />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>
          {task.estimatedMinutes} min · {DEMAND_LABELS[task.energyDemand]}
          {scheduled ? ' · in today’s plan' : ''}
        </Text>
      </View>
      <Tag label={priority.label} color={priority.color} background={priority.background} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp(2.5),
    gap: sp(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
})
