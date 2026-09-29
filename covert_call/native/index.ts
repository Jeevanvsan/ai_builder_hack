import { registerRootComponent } from 'expo'
import App from './App'
import { installGeolocation } from './src/lib/platform/geolocation'
import { configureTurn } from '../shared/video/signaling'
import { TURN } from './src/lib/config'

// react-native-webrtc's globals must be registered before any peer connection (Epic 9/11 native path). Its native
// module isn't present in Expo Go, so guard the call: this lets the app boot from an Expo Go QR for testing the
// disguise + incident flows, and still registers WebRTC in a dev/preview/production build where it IS linked.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-webrtc').registerGlobals()
} catch {
  console.warn('[QuickBite] react-native-webrtc not available (Expo Go?) — live video is disabled in this build.')
}

// navigator.geolocation doesn't exist on React Native. shared/incidents/location.ts and the live route guidance
// both read it, and both are reused from the web unchanged — install the expo-location backing before any screen
// mounts, or every incident silently falls back to a city-level IP fix.
installGeolocation()

// TURN credentials are injected from the environment, never committed — this repository is public, and a relay
// credential in it would be scraped and the quota drained. With none set the app stays on STUN, and the live
// feed only reaches a dashboard that can contact the phone directly (see shared/video/signaling.ts).
configureTurn(TURN)

registerRootComponent(App)
