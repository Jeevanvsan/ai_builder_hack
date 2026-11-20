import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { CartProvider } from './state/CartProvider.tsx'
import { configureTurn } from '../../shared/video/signaling.ts'
import { setGoogleMaps } from '../../shared/google/maps.ts'
import { setCallerUid } from '../../shared/incidents/client.ts'
import { callerReady } from './lib/caller.ts'
import './styles/tokens.css'
import './styles/global.css'
// Demo recording only (?gpsSim=lat,lng): must replace navigator.geolocation before anything asks for a fix.
import './lib/gpsSim'

// TURN credentials are injected from the environment, never committed — this repository is public, and a
// relay credential in it would be scraped and the quota drained. With none set the app stays on STUN and the
// live video only connects when both ends can reach each other directly (see shared/video/signaling.ts).
// Epic 31: sign in anonymously at load so every call from this phone carries the same caller id.
void callerReady().then(setCallerUid)

configureTurn({
  url: import.meta.env.VITE_TURN_URL,
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
})

// Google Maps web services (Places, Routes): spoken addresses and landmarks, nearby stations with phone
// numbers, and walking or driving routes. The key is public in the bundle, so in Google Cloud it is restricted to
// this app's own sites and to those APIs. Without one, the free OpenStreetMap services are used, as before.
setGoogleMaps({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
)
