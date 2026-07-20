import { Redirect } from 'expo-router'

import { useAppState } from '@/state/app-state'

export default function Index() {
  const { profile } = useAppState()
  return <Redirect href={profile ? '/(tabs)' : '/welcome'} />
}
