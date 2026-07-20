import { StyleSheet, Text, View } from 'react-native'

import { sp, type } from '@/theme/tokens'

interface SectionHeaderProps {
  title: string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={type.h2}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: sp(2),
    marginBottom: sp(3),
  },
  subtitle: {
    ...type.body,
    marginTop: sp(1),
  },
})
