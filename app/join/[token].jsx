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
  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, status, qr_code_token, host_id')
    .eq('qr_code_token', token)
    .single()

  if (error || !event) { setStatus('notfound'); return }
  if (event.status !== 'open' && event.status !== 'active') { setStatus('closed'); return }

  const { data: { user: authUser } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('event_attendees')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (!existing) {
    await supabase.from('event_attendees').insert({
      event_id: event.id,
      user_id: authUser.id,
    })
  }

  const isHost = event.host_id === authUser.id
  const { data: cohost } = await supabase
    .from('event_hosts')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', authUser.id)
    .maybeSingle()

  const role = isHost ? 'host' : cohost ? 'cohost' : 'attendee'

  await joinNight({
    id: event.id,
    name: event.name,
    qrToken: event.qr_code_token,
    role,
  })

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