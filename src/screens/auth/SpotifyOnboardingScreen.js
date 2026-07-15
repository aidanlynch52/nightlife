import { PlayfairDisplay_700Bold, useFonts } from '@expo-google-fonts/playfair-display'
import { router } from 'expo-router'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSpotify } from '../../hooks/useSpotify'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CONTENT_WIDTH = SCREEN_WIDTH > 600 ? SCREEN_WIDTH * 0.5 : SCREEN_WIDTH

export default function SpotifyOnboardingScreen() {
  const { connectSpotify } = useSpotify()
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold })

  async function handleConnect() {
    await connectSpotify()
    router.replace('/(tabs)/profile')
  }

  function handleSkip() {
    router.replace('/(tabs)/profile')
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.inner}>

        <View style={[styles.content, { width: CONTENT_WIDTH, alignSelf: 'center' }]}>
          <Text style={styles.moon}>🌙</Text>
          <Text style={[styles.appName, fontsLoaded && { fontFamily: 'PlayfairDisplay_700Bold' }]}>
            NightLife
          </Text>

          <View style={styles.divider} />

          <Text style={styles.headline}>Music molds memories.</Text>
          <Text style={styles.subheading}>
            NightLife works best when you're connected to Spotify.
          </Text>

          <TouchableOpacity style={styles.spotifyBtn} onPress={handleConnect}>
            <Text style={styles.spotifyBtnText}>Link your Spotify Account</Text>
          </TouchableOpacity>

          <Text style={styles.laterNote}>
            You can always connect Spotify later in your Profile
          </Text>
        </View>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 40, paddingTop: 20 },
  content: { paddingTop: 20, alignItems: 'center' },
  moon: { fontSize: 40, marginBottom: 12 },
  appName: { fontSize: 52, fontWeight: '700', color: '#fff', letterSpacing: 2, marginBottom: 75 },
  divider: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 32 },
  headline: { fontSize: 22, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 14, letterSpacing: 0.3 },
  subheading: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  spotifyBtn: { backgroundColor: '#1DB954', borderRadius: 30, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 16 },
  spotifyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  laterNote: { fontSize: 12, color: 'rgba(255, 255, 255, 0.59)', textAlign: 'center', lineHeight: 18 },
skipBtn: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
skipText: { fontSize: 15, color: '#000', fontWeight: '600' },
})