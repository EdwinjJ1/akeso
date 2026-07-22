import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/buttons'
import { colors, radius, sp, type } from '@/theme/tokens'

const HOURS = Array.from({ length: 24 }, (_, index) =>
  index.toString().padStart(2, '0')
)
const MINUTES = Array.from({ length: 12 }, (_, index) =>
  (index * 5).toString().padStart(2, '0')
)

interface TimeGridPickerProps {
  label: 'Start' | 'End'
  value: string
  onCancel: () => void
  onConfirm: (value: string) => void
}

export function TimeGridPicker({
  label,
  value,
  onCancel,
  onConfirm,
}: TimeGridPickerProps) {
  const [initialHour, initialMinute] = value.split(':')
  const [hour, setHour] = useState(initialHour)
  const [minute, setMinute] = useState(initialMinute)

  useEffect(() => {
    const [nextHour, nextMinute] = value.split(':')
    setHour(nextHour)
    setMinute(nextMinute)
  }, [value])

  const selectedTime = `${hour}:${minute}`

  return (
    <View style={styles.root}>
      <Text style={type.label}>CHOOSE {label.toUpperCase()} TIME</Text>
      <Text style={styles.preview}>{selectedTime}</Text>

      <ScrollView
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>HOUR</Text>
        <View style={styles.grid}>
          {HOURS.map((option) => {
            const selected = hour === option
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Hour ${option}`}
                accessibilityState={{ selected }}
                onPress={() => setHour(option)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.selectedOption,
                  pressed && styles.pressedOption,
                ]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.sectionLabel}>MINUTE</Text>
        <View style={styles.grid}>
          {MINUTES.map((option) => {
            const selected = minute === option
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Minute ${option}`}
                accessibilityState={{ selected }}
                onPress={() => setMinute(option)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.selectedOption,
                  pressed && styles.pressedOption,
                ]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button label="Cancel" onPress={onCancel} variant="ghost" />
        <View style={styles.confirmAction}>
          <Button
            label={`Use ${selectedTime}`}
            onPress={() => onConfirm(selectedTime)}
            variant="cta"
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { minHeight: 0 },
  preview: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: sp(4),
    marginTop: sp(1),
  },
  optionsScroll: { maxHeight: 300 },
  optionsContent: { paddingBottom: sp(1) },
  sectionLabel: { ...type.label, marginBottom: sp(2) },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(2),
    marginBottom: sp(4),
  },
  option: {
    width: '22%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  selectedOption: { backgroundColor: colors.lime },
  pressedOption: { opacity: 0.72 },
  optionText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(3),
    marginTop: sp(3),
  },
  confirmAction: { flex: 1 },
})
