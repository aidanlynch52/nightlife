import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import NightProvider from '../src/lib/NightContext.js'
import { supabase } from '../src/lib/supabase'

const LOGIN_TIMESTAMP_KEY = 'nightlife_login_timestamp'
const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000

async function checkSessionExpiry() {
  const stored = await AsyncStorage.getItem(LOGIN_TIMESTAMP_KEY)
  if (!stored) return
  const loggedInAt = parseInt(stored, 10)
  if (Date.now() - loggedInAt > MAX_SESSION_AGE_MS) {
    await AsyncStorage.removeItem(LOGIN_TIMESTAMP_KEY)
    await supabase.auth.signOut()
  }
}

export default function RootLayout() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/')
      }
    })

    checkSessionExpiry()

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkSessionExpiry()
    })

    return () => {
      subscription.unsubscribe()
      appStateSub.remove()
    }
  }, [])

  return (
    <ThemeProvider>
      <NightProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NightProvider>
    </ThemeProvider>
  )
}