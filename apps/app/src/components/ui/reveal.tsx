import type { ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'

interface RevealProps {
  children: ReactNode
  delay?: number
  style?: ViewStyle | ViewStyle[]
}

export function Reveal({ children, delay = 0, style }: RevealProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(420).springify().damping(18)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}
