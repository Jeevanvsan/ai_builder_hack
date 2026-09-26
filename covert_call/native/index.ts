import { registerRootComponent } from 'expo'
import App from './App'

// react-native-webrtc's globals must be registered before any peer connection (Epic 9/11 native path). Its native
// module isn't present in Expo Go, so guard the call: this lets the app boot from an Expo Go QR for testing the
// disguise + incident flows, and still registers WebRTC in a dev/preview/production build where it IS linked.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-webrtc').registerGlobals()
} catch {
  console.warn('[QuickBite] react-native-webrtc not available (Expo Go?) — live video is disabled in this build.')
}

registerRootComponent(App)
