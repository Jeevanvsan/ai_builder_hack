import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { CartProvider } from './src/state/cart'
import { AppearanceProvider, useAppearance } from './src/lib/appearance'
import { HomeScreen } from './src/screens/HomeScreen'
import { CartScreen } from './src/screens/CartScreen'
import { CheckoutScreen } from './src/screens/CheckoutScreen'
import { OrderPlacedScreen } from './src/screens/OrderPlacedScreen'
import { CallScreen } from './src/screens/CallScreen'
import { SilentTapScreen } from './src/screens/SilentTapScreen'
import { SosScreen } from './src/screens/SosScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { colors } from './src/theme'

// Route params. The SOS screen takes none; navigating there IS the trigger (Epic 11).
export type RootStackParamList = {
  Home: undefined
  Cart: undefined
  Checkout: undefined
  // Carries the incident id from a coded order so the tracking screen can mirror the responder's progress as
  // ordinary delivery milestones (Epic 8.3). Undefined for an ordinary order — which is most of them.
  OrderPlaced: { incidentId?: string } | undefined
  // Epic 25: `demo` = hidden demo call (long-press the logo), written to demoIncidents, never on the dashboard.
  Call: { demo?: boolean } | undefined
  SilentTap: undefined
  Sos: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function Navigation() {
  const { ready } = useAppearance()
  // Hold the first frame until the saved disguise name has loaded, otherwise an app renamed to something else
  // briefly shows "QuickBite" on launch — exactly what the personalisation exists to avoid (Epic 13.2).
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.surface }} />

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} />
        <Stack.Screen name="Call" component={CallScreen} />
        <Stack.Screen name="SilentTap" component={SilentTapScreen} />
        {/* The SOS screen is a full-black overlay; disable the gesture/animation so it appears instantly. */}
        <Stack.Screen name="Sos" component={SosScreen} options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <CartProvider>
          <Navigation />
        </CartProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  )
}
