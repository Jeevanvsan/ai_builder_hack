/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  // A vector Map ID with the muted "board" cloud style (Google Cloud console); Google's demo ID when unset.
  readonly VITE_GOOGLE_MAP_ID?: string
  readonly VITE_USE_EMULATOR?: string
}
