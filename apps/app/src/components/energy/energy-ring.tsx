import type { EnergyBand } from '@akeso/domain'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { colors, energyColors, energyLabels } from '@/theme/tokens'

interface EnergyRingProps {
  score: number
  band: EnergyBand
  size?: number
}

export function EnergyRing({ score, band, size = 172 }: EnergyRingProps) {
  const strokeWidth = 14
  const ringRadius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * ringRadius
  const progress = Math.min(Math.max(score, 0), 100) / 100
  const center = size / 2

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={energyColors[band]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.centerContent}>
        <Text style={[styles.score, { color: energyColors[band] }]}>{score}</Text>
        <Text style={styles.bandLabel}>{energyLabels[band]}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  bandLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
})
