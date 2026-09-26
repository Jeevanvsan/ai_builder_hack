import { lazy, Suspense } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import { livePosition, routeProgress } from '../lib/livePosition'

const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// Lazy so only the map library actually in use is downloaded.
const GoogleIncidentMap = lazy(() => import('./GoogleIncidentMap'))
const OsmIncidentMap = lazy(() => import('./OsmIncidentMap'))

export default function IncidentMap({
  location,
  backdrop = false,
  route,
}: {
  location: Incident['location']
  backdrop?: boolean
  route?: Incident['safeRoute']
}) {
  const { rough, confirmed, track } = location
  // A "confirmed" address that failed to geocode has no lat/lng (see confirmAddress()) — it's not a usable pin,
  // so it's skipped here in favour of the rough fix rather than plotting the map at `null, null`.
  const pinned = confirmed && confirmed.lat != null && confirmed.lng != null ? { lat: confirmed.lat, lng: confirmed.lng, address: confirmed.address } : null
  const target = livePosition(location)
  if (!target) return <div className="map map-loading">Locating caller…</div>
  // The turn marker follows the caller's live progress, not the step stored when the route was computed.
  const liveRoute = route ? { ...route, stepIndex: routeProgress(route, target).stepIndex } : route

  const props = { rough, confirmed: pinned, target: { lat: target.lat, lng: target.lng }, live: target.source === 'track', backdrop, track, route: liveRoute }
  return (
    <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
      {googleMapsKey ? <GoogleIncidentMap {...props} apiKey={googleMapsKey} /> : <OsmIncidentMap {...props} />}
    </Suspense>
  )
}
