import { lazy, Suspense } from 'react'
import type { Incident } from '../../../shared/incidents/types'

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
  // A moving caller is followed at their latest GPS point; otherwise the confirmed address, then the rough fix.
  const last = track?.length ? track[track.length - 1] : null
  const target = (track && track.length > 1 ? last : null) ?? confirmed ?? rough
  if (!target) return <div className="map map-loading">Locating caller…</div>

  const props = { rough, confirmed, target: { lat: target.lat, lng: target.lng }, backdrop, track, route }
  return (
    <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
      {googleMapsKey ? <GoogleIncidentMap {...props} apiKey={googleMapsKey} /> : <OsmIncidentMap {...props} />}
    </Suspense>
  )
}
