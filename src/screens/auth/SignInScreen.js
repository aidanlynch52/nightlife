import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function SignInScreen() {
  const { mode: initialMode } = useLocalSearchParams()
  const [mode, setMode] = useState(initialMode || 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const { signIn, signUp } = useAuth()

  useEffect(() => {
    if (mode !== 'signup' || !username.trim() || username.trim().length < 2) {
      setUsernameAvailable(null)
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username.trim())
        .maybeSingle()
      setUsernameAvailable(!data)
    }, 400)
    return () => clearTimeout(timer)
  }, [username, mode])

  async function handleSubmit() {
    setLoading(true)
    setError('')
    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) setError(JSON.stringify(error))
      else router.replace('/(tabs)/home')
    } else {
      if (!username.trim()) { setError('Please enter a username'); setLoading(false); return }
      if (usernameAvailable === false) { setError('That username is already taken'); setLoading(false); return }
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username.trim())
        .maybeSingle()
      if (existing) { setError('That username is already taken'); setLoading(false); return }
      const { error } = await signUp(email, password, username.trim(), displayName)
      if (error) setError(JSON.stringify(error))
      else router.replace('/(tabs)/home')
    }
    setLoading(false)
  }

  return (
    <LinearGradient
      colors={['#000005', '#000510', '#001030', '#002060']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        {mode === 'signup' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            {username.trim().length >= 2 && (
              <Text style={[styles.usernameStatus, { color: usernameAvailable === false ? '#ff6b6b' : '#3DDC84' }]}>
                {usernameAvailable === null ? '' : usernameAvailable ? '✓ Username available' : '✗ Username already taken'}
              </Text>
            )}
          </>
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.btnPrimaryText}>{loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        </TouchableOpacity>
       <Text style={styles.toggleStatic}>
  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
  <Text
    style={styles.toggleLink}
    onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
    {mode === 'signin' ? 'Sign up' : 'Sign in'}
  </Text>
</Text>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 24, paddingTop: 20 },
  back: { marginBottom: 24 },
  backText: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 28, fontWeight: '600', color: '#fff', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12, color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)' },
  usernameStatus: { fontSize: 12, marginTop: -8, marginBottom: 10, marginLeft: 4 },
  btnPrimary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
  toggle: { textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },
  toggleStatic: { textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.5)', fontSize: 14 },
toggleLink: { color: '#fff', textDecorationLine: 'underline', fontWeight: '500' },
})