import { PlayfairDisplay_700Bold, useFonts } from '@expo-google-fonts/playfair-display'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const STARS = Array.from({ length: 59 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: i < 40 ? Math.random() * 50 : 50 + Math.random() * 50,
  size: Math.random() * 2.5 + .75,
}))

function Star({ x, y, size }) {
  return (
    <View style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#fff',
    }} />
  )
}

export default function OnboardingScreen() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold })

  return (
    <LinearGradient
      colors={['#000005', '#000510', '#001030', '#002060']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}>
      <SafeAreaView style={styles.container}>

        {STARS.map(s => (
          <Star key={s.id} x={s.x} y={s.y} size={s.size} />
        ))}

        <View style={styles.hero}>
          <Text style={[
            styles.title,
            fontsLoaded && { fontFamily: 'PlayfairDisplay_700Bold' }
          ]}>
            NightLife
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/signin')}>
            <Text style={styles.btnPrimaryText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push({ pathname: '/(auth)/signin', params: { mode: 'signup' } })}>
            <Text style={styles.btnSecondaryText}>Get started</Text>
          </TouchableOpacity>
          
        </View>

      </SafeAreaView>
    </LinearGradient>
  )
  
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 60 },
  title: { fontSize: 76, fontWeight: '700', color: '#fff', letterSpacing: 2, marginBottom: 16 },
  buttons: { paddingBottom: 20, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, width: '100%', maxWidth: 650 },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
  btnSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%', maxWidth: 650 },
  btnSecondaryText: { color: '#fff', fontSize: 16 },
})