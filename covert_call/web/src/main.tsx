import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { CartProvider } from './state/CartProvider.tsx'
import { configureTurn } from '../../shared/video/signaling.ts'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
)
