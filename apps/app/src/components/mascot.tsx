import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

export type MascotState = 'high' | 'steady' | 'low' | 'celebrate'

const sources = {
  high: require('../../assets/images/akeso/mascot-high.png'),
  steady: require('../../assets/images/akeso/mascot-steady.png'),
  low: require('../../assets/images/akeso/mascot-low.png'),
  celebrate: require('../../assets/images/akeso/mascot-celebrate.png'),
} as const

interface MascotProps {
  state: MascotState
  size?: number
}

export function Mascot({ state, size = 160 }: MascotProps) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Image
        source={sources[state]}
        style={styles.image}
        contentFit="contain"
        transition={180}
        accessibilityLabel={`Akeso mascot, ${state} energy`}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
})
