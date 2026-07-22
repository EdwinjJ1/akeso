import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { Mascot } from '@/components/mascot'
import { colors } from '@/theme/tokens'

export function CoachFab() {
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        accessibilityHint="Opens a conversation with your energy coach"
        accessibilityLabel="Talk to Akeso"
        accessibilityRole="button"
        onPress={() => router.push('../coach')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Mascot state="steady" size={68} />
        <View style={styles.badge}>
          <Ionicons name="chatbubble" size={13} color={colors.text} />
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    inset: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 84,
    paddingRight: 14,
  },
  button: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    borderColor: colors.text,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'visible',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  pressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  badge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.text,
    borderRadius: 13,
    borderWidth: 1.5,
  },
})
