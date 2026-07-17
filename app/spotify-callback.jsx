import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

WebBrowser.maybeCompleteAuthSession()

export default function SpotifyCallbackScreen() {
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    setTimeout(() => setStatus('success'), 500)
    setTimeout(() => router.replace('/(tabs)/profile'), 2500)
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: status === 'success' ? '#1DB954' : '#000' }}>
      {status === 'connecting' ? (
        <Text style={{ color: '#fff', fontSize: 16 }}>Connecting Spotify...</Text>
      ) : (
        <>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>✓</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 6 }}>Spotify Connected</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Taking you to your profile...</Text>
        </>
      )}
    </View>
  )
}