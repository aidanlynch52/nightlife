import { Tabs } from 'expo-router'
import { Dimensions, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useNight } from '../../src/lib/NightContext.js'

const TAB_HEIGHT = Dimensions.get('window').height * 0.065
const SCREEN_WIDTH = Dimensions.get('window').width
const isDesktop = SCREEN_WIDTH > 600

function TabBar({ state, descriptors, navigation }) {
  const { activeNight } = useNight()
  const { colors } = useTheme()

  const isInNight = !!activeNight
  const isHost = activeNight?.role === 'host' || activeNight?.role === 'cohost'

  let tabs = [
    { name: 'home', label: 'Home' },
    { name: 'messages', label: 'Messages' },
    { name: 'create', label: 'Night' },
    { name: 'profile', label: 'Profile' },
  ]
  if (isInNight && isHost) {
    tabs = isDesktop ? [
      { name: 'home', label: 'Home' },
      { name: 'messages', label: 'Messages' },
      { name: 'camera', label: 'Camera' },
      { name: 'catalog', label: 'Catalog' },
      { name: 'qr', label: activeNight?.name || 'QR' },
      { name: 'profile', label: 'Profile' },
    ] : [
      { name: 'home', label: 'Home' },
      { name: 'camera', label: 'Camera' },
      { name: 'qr', label: 'Night' },
      { name: 'profile', label: 'Profile' },
    ]
  } else if (isInNight) {
    tabs = isDesktop ? [
      { name: 'home', label: 'Home' },
      { name: 'messages', label: 'Messages' },
      { name: 'camera', label: 'Camera' },
      { name: 'catalog', label: 'Catalog' },
      { name: 'profile', label: 'Profile' },
    ] : [
      { name: 'home', label: 'Home' },
      { name: 'camera', label: 'Camera' },
      { name: 'qr', label: 'Night' },
      { name: 'profile', label: 'Profile' },
    ]
  }

  // Camera tab is mobile-only — desktop/web users don't have a device
  // camera integrated the same way, so strip it out of the desktop tab set.
  if (isDesktop) {
    tabs = tabs.filter(tab => tab.name !== 'camera')
  }

  return (
    <View style={{
      flexDirection: 'row',
      height: TAB_HEIGHT,
      backgroundColor: colors.tabBarBackground,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    }}>
      {tabs.map((tab, index) => {
        const focused = state.routes[state.index]?.name === tab.name
        return (
          <TouchableOpacity
            key={tab.name}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? colors.inputBackground : colors.tabBarBackground,
              borderLeftWidth: index > 0 ? 1 : 0,
              borderLeftColor: colors.border,
            }}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}>
            <Text style={{
              fontSize: 13,
              fontWeight: focused ? '700' : '400',
              color: focused ? colors.text : colors.textSecondary,
            }}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="conversation" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="camera" />
      <Tabs.Screen name="catalog" />
      <Tabs.Screen name="qr" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}