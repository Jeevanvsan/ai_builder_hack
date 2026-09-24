import { lazy, Suspense } from 'react'
import type { Incident } from '../../../shared/incidents/types'

const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// Lazy so only the map library actually in use is downloaded.
const GoogleIncidentMap = lazy(() => import('./GoogleIncidentMap'))
const OsmIncidentMap = lazy(() => import('./OsmIncidentMap'))

export default function IncidentMap({ location }: { location: Incident['location'] }) {
  const { rough, confirmed } = location
  const target = confirmed ?? rough
  if (!target) return <div className="map map-loading">Locating caller…</div>

  const props = { rough, confirmed, target: { lat: target.lat, lng: target.lng } }
  return (
    <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
      {googleMapsKey ? <GoogleIncidentMap {...props} apiKey={googleMapsKey} /> : <OsmIncidentMap {...props} />}
    </Suspense>
  )
}
