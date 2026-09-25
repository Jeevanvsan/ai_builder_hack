import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Same Firebase project as the web app and dashboard (quickbite-5cde0). The app never signs in; it only writes
// unauthenticated incident data through the shared client, per covert_call/dashboard/firestore.rules.
//
// Config comes from EXPO_PUBLIC_* env vars (Expo inlines these at build). Copy them from the web app's values.
// NOTE (untested): on React Native, long-lived Firestore streams sometimes need
// `initializeFirestore(app, { experimentalForceLongPolling: true })` instead of getFirestore — switch if the
// live listeners misbehave on a device.
export const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
})

export const db = getFirestore(app)
