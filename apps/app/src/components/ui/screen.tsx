import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, sp } from '@/theme/tokens'

interface ScreenProps {
  children: ReactNode
  /** Extra bottom padding for screens under the tab bar */
  tabbed?: boolean
  scrollable?: boolean
}

export function Screen({ children, tabbed = false, scrollable = true }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top + sp(4),
    paddingBottom: (tabbed ? sp(24) : insets.bottom + sp(6)),
    paddingHorizontal: sp(4.5),
  }

  if (!scrollable) {
    return <View style={[styles.container, padding]}>{children}</View>
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, padding]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    maxWidth: 560,
    width: '100%',
    boxSizing: 'border-box',
    alignSelf: 'center',
  },
})
