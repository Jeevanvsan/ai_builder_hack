import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { configureTurn } from '../../shared/video/signaling.ts'
import { setGoogleMaps } from '../../shared/google/maps.ts'
import { googleMapsKey } from './lib/googleMaps'

// TURN credentials are injected from the environment, never committed — this repository is public, and a
// relay credential in it would be scraped and the quota drained. With none set the dashboard stays on STUN and
// only sees the feed when it can reach the caller's phone directly (see shared/video/signaling.ts).
configureTurn({
  url: import.meta.env.VITE_TURN_URL,
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
})

// The same key also serves the web services the board uses (nearby stations, "Route here"); OpenStreetMap without it.
setGoogleMaps({ key: googleMapsKey })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user" makes every motion.* component honor prefers-reduced-motion automatically. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
