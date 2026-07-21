import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import NightProvider from '../src/lib/NightContext.js'
import { supabase } from '../src/lib/supabase'

export default function RootLayout() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider>
      <NightProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NightProvider>
    </ThemeProvider>
  )
}