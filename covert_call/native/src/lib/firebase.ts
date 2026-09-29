import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { FIREBASE_CONFIG } from './config'

// Same Firebase project as the web app and dashboard (quickbite-5cde0). The app never signs in; it only writes
// unauthenticated incident data through the shared client, per covert_call/dashboard/firestore.rules.
//
// Config comes from EXPO_PUBLIC_* env vars (see lib/config.ts), copied from the web app's values.
export const app = initializeApp(FIREBASE_CONFIG)

// React Native's networking doesn't support the streaming transport the Firestore SDK prefers, so its real-time
// listeners can hang or silently stop. Auto-detect falls back to long polling only when it's actually needed,
// which matters here because the order-tracking screen and the WebRTC signalling both depend on onSnapshot
// staying live for the whole session.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
