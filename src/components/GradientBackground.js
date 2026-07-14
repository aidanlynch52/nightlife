import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

export default function GradientBackground({ children, style }) {
  return (
    <LinearGradient
      colors={['#000005', '#000510', '#001030', '#002060']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.gradient, style]}>
      {children}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
})