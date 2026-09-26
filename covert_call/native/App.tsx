import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { CartProvider } from './src/state/cart'
import { AppearanceProvider } from './src/lib/appearance'
import { HomeScreen } from './src/screens/HomeScreen'
import { CartScreen } from './src/screens/CartScreen'
import { CheckoutScreen } from './src/screens/CheckoutScreen'
import { OrderPlacedScreen } from './src/screens/OrderPlacedScreen'
import { CallScreen } from './src/screens/CallScreen'
import { SilentTapScreen } from './src/screens/SilentTapScreen'
import { SosScreen } from './src/screens/SosScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'

// Route params. The SOS screen takes none; navigating there IS the trigger (Epic 11).
export type RootStackParamList = {
  Home: undefined
  Cart: undefined
  Checkout: undefined
  OrderPlaced: undefined
  Call: undefined
  SilentTap: undefined
  Sos: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function App() {
  return (
    <AppearanceProvider>
      <CartProvider>
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
      </CartProvider>
    </AppearanceProvider>
  )
}
