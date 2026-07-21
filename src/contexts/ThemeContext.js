import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'nightlife_theme_mode'

const lightColors = {
  mode: 'light',
  background: '#ffffff',
  backgroundGradient: ['#e8e8e8', '#ffffff'],
  cardBackground: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  textMuted: '#888888',
  border: '#ebebeb',
  borderStrong: '#dddddd',
  inputBackground: '#f9f9f9',
  tabBarBackground: '#ffffff',
  danger: '#cc0000',
}

const darkColors = {
  mode: 'dark',
  background: '#000510',
  backgroundGradient: ['#000005', '#000510', '#001030', '#002060'],
  cardBackground: '#0a1428',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.15)',
  borderStrong: 'rgba(255,255,255,0.3)',
  inputBackground: 'rgba(255,255,255,0.08)',
  tabBarBackground: '#000510',
  danger: '#ff4444',
}

const ThemeContext = createContext({
  colors: lightColors,
  mode: 'light',
  toggleTheme: () => {},
  loading: true,
})

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'dark' || stored === 'light') setMode(stored)
      setLoading(false)
    })
  }, [])

  async function toggleTheme() {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next)
  }

  const colors = mode === 'dark' ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ colors, mode, toggleTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}