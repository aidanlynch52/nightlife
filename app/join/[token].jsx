import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAuth } from '../../src/hooks/useAuth'
import { useNight } from '../../src/lib/NightContext'
import { supabase } from '../../src/lib/supabase'

export default function JoinScreen() {
  const { token } = useLocalSearchParams()
  const { user } = useAuth()
  const { joinNight } = useNight()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    if (!user) return
    handleJoin()
  }, [token, user])

  async function handleJoin() {
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('qr_code_token', token)
      .single()

    if (!event) { setStatus('notfound'); return }
    if (event.status !== 'open') { setStatus('closed'); return }

    const { data: existing } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      await supabase.from('event_attendees').insert({
        event_id: event.id,
        user_id: user.id,
      })
    }

    await joinNight(event.id)
    router.replace('/(tabs)/camera')
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#111" />
          <Text style={{ marginTop: 16, fontSize: 15, color: '#555' }}>Joining night...</Text>
        </>
      )}
      {status === 'notfound' && <Text style={{ fontSize: 15, color: '#333' }}>Night not found.</Text>}
      {status === 'closed' && <Text style={{ fontSize: 15, color: '#333' }}>This night has already ended.</Text>}
      {status === 'error' && <Text style={{ fontSize: 15, color: '#333' }}>Invalid QR code.</Text>}
    </View>
  )
}