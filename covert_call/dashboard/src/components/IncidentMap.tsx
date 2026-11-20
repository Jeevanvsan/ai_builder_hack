import { lazy, Suspense, useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import { googleMapsKey } from '../lib/googleMaps'
import { livePosition, routeProgress } from '../lib/livePosition'
import type { MapView } from './mapTypes'

// Lazy so only the map library actually in use is downloaded.
const GoogleIncidentMap = lazy(() => import('./GoogleIncidentMap'))
const GoogleIncident3D = lazy(() => import('./GoogleIncident3D'))
const OsmIncidentMap = lazy(() => import('./OsmIncidentMap'))

const VIEWS: { id: MapView; label: string; hint: string }[] = [
  { id: 'map', label: 'Map', hint: 'Street map' },
  { id: 'satellite', label: 'Satellite', hint: 'Satellite photos with street names' },
  { id: '3d', label: '3D', hint: 'Photorealistic 3D, like Google Earth' },
]

export default function IncidentMap({
  location,
  backdrop = false,
  route,
}: {
  location: Incident['location']
  backdrop?: boolean
  route?: Incident['safeRoute']
}) {
  const [view, setView] = useState<MapView>('map')
  const { rough, confirmed, track } = location
  // A "confirmed" address that failed to geocode has no lat/lng (see confirmAddress()) — it's not a usable pin,
  // so it's skipped here in favour of the rough fix rather than plotting the map at `null, null`.
  const pinned = confirmed && confirmed.lat != null && confirmed.lng != null ? { lat: confirmed.lat, lng: confirmed.lng, address: confirmed.address } : null
  const target = livePosition(location)
  // An address that failed to geocode has no lat/lng and never will: say so instead of waiting forever.
  if (!target) return <div className="map map-loading">{confirmed ? (pinned ? 'Placing the address the caller gave…' : "Couldn't place this address on the map — see the address the caller gave") : 'Locating caller…'}</div>
  // The turn marker follows the caller's live progress, not the step stored when the route was computed.
  const liveRoute = route ? { ...route, stepIndex: routeProgress(route, target).stepIndex } : route

  // The ring only means something around a phone fix (not a landmark the caller named, an IP guess or an address).
  const accuracyM = target.basis === 'gps' || target.basis === 'sim' ? target.accuracyM : null
  const props = { rough, confirmed: pinned, target: { lat: target.lat, lng: target.lng, accuracyM }, live: target.source === 'track', backdrop, track, route: liveRoute }
  if (!googleMapsKey) {
    return (
      <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
        <OsmIncidentMap {...props} />
      </Suspense>
    )
  }
  return (
    <div className="map-frame">
      <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
        {view === '3d'
          ? <GoogleIncident3D {...props} apiKey={googleMapsKey} />
          : <GoogleIncidentMap {...props} apiKey={googleMapsKey} view={view} />}
      </Suspense>
      <div className="map-views" role="group" aria-label="Map view">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" title={v.hint} aria-pressed={view === v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {view === '3d' && <p className="map-views-note">Real 3D buildings only where Google has them (e.g. Singapore); elsewhere satellite over terrain.</p>}
    </div>
  )
}
