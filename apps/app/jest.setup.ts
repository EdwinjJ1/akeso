import { jest } from '@jest/globals'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native')
  const animation = {
    delay: () => animation,
    duration: () => animation,
    springify: () => animation,
    damping: () => animation,
  }
  return { __esModule: true, default: { View }, FadeInUp: animation }
})
