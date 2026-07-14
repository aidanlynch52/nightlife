import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../hooks/useAuth'

import OnboardingScreen from '../screens/auth/OnboardingScreen'
import SignInScreen from '../screens/auth/SignInScreen'
import AttendeesScreen from '../screens/event/AttendeesScreen.js'
import CreateEventScreen from '../screens/event/CreateEventScreen'
import NightDetailScreen from '../screens/event/NightDetailScreen'
import QRDisplayScreen from '../screens/event/QRDisplayScreen'
import QRScanScreen from '../screens/event/QRScanScreen'
import WelcomeBannerScreen from '../screens/event/WelcomeBannerScreen'
import HomeScreen from '../screens/home/HomeScreen'
import MapScreen from '../screens/map/MapScreen'
import SetlistScreen from '../screens/music/SetlistScreen'
import CameraScreen from '../screens/partymode/CameraScreen'
import CatalogScreen from '../screens/partymode/CatalogScreen'
import ChatScreen from '../screens/partymode/ChatScreen'
import ProfileScreen from '../screens/profile/ProfileScreen'
import PostViewScreen from '../screens/scrapbook/PostViewScreen'
import ScrapbookBuilderScreen from '../screens/scrapbook/ScrapbookBuilderScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Night" component={CatalogScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function Navigation() {
  const { user } = useAuth()

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
            <Stack.Screen name="QRDisplay" component={QRDisplayScreen} />
            <Stack.Screen name="QRScan" component={QRScanScreen} />
            <Stack.Screen name="WelcomeBanner" component={WelcomeBannerScreen} />
            <Stack.Screen name="NightDetail" component={NightDetailScreen} />
            <Stack.Screen name="Attendees" component={AttendeesScreen} />
            <Stack.Screen name="Camera" component={CameraScreen} />
            <Stack.Screen name="Catalog" component={CatalogScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Setlist" component={SetlistScreen} />
            <Stack.Screen name="ScrapbookBuilder" component={ScrapbookBuilderScreen} />
            <Stack.Screen name="PostView" component={PostViewScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}