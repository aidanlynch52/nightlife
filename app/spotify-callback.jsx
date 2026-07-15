import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { Text, View } from 'react-native'

export default function SpotifyCallbackScreen() {
  const params = useLocalSearchParams()

  useEffect(() => {
    // The useSpotify hook handles the response via expo-auth-session
    // Just redirect to profile after a short delay
    setTimeout(() => {
      router.replace('/(tabs)/profile')
    }, 1000)
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Connecting Spotify...</Text>
    </View>
  )
}