import { Tabs } from 'expo-router'
import { Dimensions, Text, TouchableOpacity, View } from 'react-native'
import { useNight } from '../../src/lib/NightContext.js'

const TAB_HEIGHT = Dimensions.get('window').height * 0.065
const SCREEN_WIDTH = Dimensions.get('window').width

function TabBar({ state, descriptors, navigation }) {
  const { activeNight } = useNight()

  const isInNight = !!activeNight
  const isHost = activeNight?.role === 'host' || activeNight?.role === 'cohost'

  let tabs = [
    { name: 'home', label: 'Home' },
    { name: 'messages', label: 'Messages' },
    { name: 'create', label: 'Night' },
    { name: 'profile', label: 'Profile' },
  ]
if (isInNight && isHost) {
  tabs = SCREEN_WIDTH > 600 ? [
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
  tabs = SCREEN_WIDTH > 600 ? [
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
  return (
    <View style={{
      flexDirection: 'row',
      height: TAB_HEIGHT,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
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
              backgroundColor: focused ? '#d0d0d0' : '#fff',
              borderLeftWidth: index > 0 ? 1 : 0,
              borderLeftColor: '#e0e0e0',
            }}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}>
            <Text style={{
              fontSize: 13,
              fontWeight: focused ? '700' : '400',
              color: focused ? '#111' : '#888',
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