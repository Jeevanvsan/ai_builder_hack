import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// Same Firebase project as the dashboard (quickbite-5cde0) — the QuickBite app never signs in, it only writes
// unauthenticated incident data via the shared client, per covert_call/dashboard/firestore.rules.
export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const db = getFirestore(app)

if (import.meta.env.VITE_USE_EMULATOR === 'true') connectFirestoreEmulator(db, '127.0.0.1', 8080)
