import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import { useNight } from '../../lib/NightContext'
import { supabase } from '../../lib/supabase'

export default function QRDisplayScreen() {
  const { eventId, eventName, qrToken } = useLocalSearchParams()
  const [sharing, setSharing] = useState(false)
  const { user } = useAuth()
  const { joinNight } = useNight()

  useEffect(() => {
    async function setup() {
      if (!eventId || !user) return
      await supabase.from('event_attendees').insert({ event_id: eventId, user_id: user.id })
      joinNight({ id: eventId, name: eventName, qrToken, role: 'host' })
      router.replace('/(tabs)/qr')
    }
    setup()
  }, [eventId, user])

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      await Share.share({
        message: `Join ${eventName} on NightLife! Use this code to scan in: ${qrToken}`,
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <LinearGradient
      colors={['#000005', '#000510', '#001030', '#002060']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{eventName}</Text>
          <Text style={styles.subtitle}>Share or display this QR to let people in</Text>
        </View>
        <View style={styles.qrSection}>
          <View style={styles.qrBox}>
            <QRCode
              value={qrToken || 'nightlife'}
              size={220}
              color="#000"
              backgroundColor="#fff"
            />
          </View>
          <Text style={styles.tokenText}>{qrToken}</Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleShare} disabled={sharing}>
            <Text style={styles.btnPrimaryText}>{sharing ? 'Sharing...' : 'Share QR'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { marginBottom: 32 },
  back: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  qrSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  qrBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16 },
  tokenText: { fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  buttons: { gap: 12, paddingBottom: 20 },
  btnPrimary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
})