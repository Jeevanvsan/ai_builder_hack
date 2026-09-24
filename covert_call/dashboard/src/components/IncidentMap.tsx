import { lazy, Suspense } from 'react'
import type { Incident } from '../lib/types'

const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// Lazy so only the map library actually in use is downloaded.
const GoogleIncidentMap = lazy(() => import('./GoogleIncidentMap'))
const OsmIncidentMap = lazy(() => import('./OsmIncidentMap'))

export default function IncidentMap({ location }: { location: Incident['location'] }) {
  return (
    <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
      {googleMapsKey
        ? <GoogleIncidentMap location={location} apiKey={googleMapsKey} />
        : <OsmIncidentMap location={location} />}
    </Suspense>
  )
}
