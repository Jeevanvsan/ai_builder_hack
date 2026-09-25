import { registerRootComponent } from 'expo'
// react-native-webrtc needs its globals registered before any peer connection is created (Epic 9/11 native path).
import { registerGlobals } from 'react-native-webrtc'
import App from './App'

registerGlobals()
registerRootComponent(App)
