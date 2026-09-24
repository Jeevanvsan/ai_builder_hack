import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

process.loadEnvFile(new URL('../.env.local', import.meta.url))

export const db = getFirestore(
  initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  }),
)

if (process.argv.includes('--emulator')) connectFirestoreEmulator(db, '127.0.0.1', 8080)
