import type { EnergyCurvePoint, HourWindow } from '@akeso/domain'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { colors, sp } from '@/theme/tokens'
import { formatHour } from '@/utils/dates'

interface EnergyCurveProps {
  curve: EnergyCurvePoint[]
  peakWindow: HourWindow
  dipWindow: HourWindow
  height?: number
}

/** Predicted energy across the day, with peak/dip windows shaded */
export function EnergyCurve({ curve, peakWindow, dipWindow, height = 132 }: EnergyCurveProps) {
  const [width, setWidth] = useState(0)

  if (curve.length < 2) {
    return null
  }

  const firstHour = curve[0].hour
  const lastHour = curve[curve.length - 1].hour
  const hourSpan = lastHour - firstHour
  const chartHeight = height - 22

  const x = (hour: number) => ((hour - firstHour) / hourSpan) * width
  const y = (level: number) => chartHeight - (level / 100) * (chartHeight - 8) - 4

  const linePath = curve
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L'
      return `${command}${x(point.hour).toFixed(1)},${y(point.level).toFixed(1)}`
    })
    .join(' ')

  const areaPath = `${linePath} L${x(lastHour).toFixed(1)},${chartHeight} L${x(firstHour).toFixed(1)},${chartHeight} Z`

  const windowRect = (window: HourWindow, fill: string) => (
    <Rect
      x={x(window.startHour)}
      y={0}
      width={x(window.endHour) - x(window.startHour)}
      height={chartHeight}
      fill={fill}
      rx={6}
    />
  )

  const axisHours = [8, 12, 16, 20].filter(
    (hour) => hour >= firstHour && hour <= lastHour
  )

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={chartHeight}>
            <Defs>
              <LinearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {windowRect(peakWindow, 'rgba(5,150,105,0.10)')}
            {windowRect(dipWindow, 'rgba(220,38,38,0.07)')}
            <Path d={areaPath} fill="url(#curveFill)" />
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.axis}>
            {axisHours.map((hour) => (
              <Text
                key={hour}
                style={[
                  styles.axisLabel,
                  { position: 'absolute', left: x(hour) - 14 },
                ]}
              >
                {formatHour(hour)}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={{ height: chartHeight }} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  axis: {
    height: 20,
    marginTop: sp(0.5),
  },
  axisLabel: {
    fontSize: 11,
    color: colors.textMuted,
    width: 32,
    textAlign: 'center',
  },
})
