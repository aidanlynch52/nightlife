import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '../src/lib/supabase'
import OnboardingScreen from '../src/screens/auth/OnboardingScreen'

const LOGIN_TIMESTAMP_KEY = 'nightlife_login_timestamp'
const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000

export default function Index() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkSessionAndRoute()
  }, [])

  async function checkSessionAndRoute() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setChecking(false)
      return
    }

    const stored = await AsyncStorage.getItem(LOGIN_TIMESTAMP_KEY)

    if (!stored) {
      // Session existed before this feature shipped — start the clock now.
      await AsyncStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString())
      router.replace('/(tabs)/home')
      return
    }

    const loggedInAt = parseInt(stored, 10)
    if (Date.now() - loggedInAt > MAX_SESSION_AGE_MS) {
      await AsyncStorage.removeItem(LOGIN_TIMESTAMP_KEY)
      await supabase.auth.signOut()
      setChecking(false)
      return
    }

    router.replace('/(tabs)/home')
  }

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000510' }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return <OnboardingScreen />
}