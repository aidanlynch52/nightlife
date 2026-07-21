import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LOGIN_TIMESTAMP_KEY = 'nightlife_login_timestamp'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      await AsyncStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString())
    }
    return { error }
  }

  async function signUp(email, password, username, displayName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName }
      }
    })
    if (!error) {
      await AsyncStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString())
    }
    return { error }
  }

  async function signOut() {
    await AsyncStorage.removeItem(LOGIN_TIMESTAMP_KEY)
    await supabase.auth.signOut()
  }

  return { user, profile, loading, signIn, signUp, signOut }
}