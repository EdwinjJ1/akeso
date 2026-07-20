import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { todayISO } from '@/utils/dates'

const millisecondsUntilNextLocalDay = () => {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1, tomorrow.getTime() - now.getTime())
}

export function useDashboardRefresh(refreshToday: () => Promise<void>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appState = useRef<AppStateStatus | null>(AppState.currentState)
  const observedDay = useRef(todayISO())

  const clearDayBoundary = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const scheduleDayBoundary = useCallback(() => {
    clearDayBoundary()
    if (appState.current === 'background' || appState.current === 'inactive') return

    timer.current = setTimeout(() => {
      timer.current = null
      const currentDay = todayISO()
      if (currentDay !== observedDay.current) {
        observedDay.current = currentDay
        void refreshToday()
      }
      scheduleDayBoundary()
    }, millisecondsUntilNextLocalDay())
  }, [clearDayBoundary, refreshToday])

  useFocusEffect(
    useCallback(() => {
      observedDay.current = todayISO()
      void refreshToday()
    }, [refreshToday])
  )

  useEffect(() => {
    scheduleDayBoundary()
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState
      if (nextState === 'active') {
        observedDay.current = todayISO()
        void refreshToday()
        scheduleDayBoundary()
      } else {
        clearDayBoundary()
      }
    })

    return () => {
      subscription.remove()
      clearDayBoundary()
    }
  }, [clearDayBoundary, refreshToday, scheduleDayBoundary])
}
