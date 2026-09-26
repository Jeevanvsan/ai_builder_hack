import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { MapProps } from './mapTypes'

function FollowTarget({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lng])
  }, [map, lat, lng])
  // Leaflet sizes its tiles at mount; when the board resizes afterwards the uncovered area stays grey.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

// Zooms out just enough to show the whole route (plus the caller) when it doesn't fit the current view, once per
// new route — so a route is never silently off-screen.
// The case board overlays a fixed ring of info tiles (vehicle/location/subjects/threat/stress/etc.) around every
// edge of the map, leaving only the centre "hub" clear. A uniform fitBounds padding only controls zoom, not WHERE
// content lands — the route/destination/police-station label could end up anywhere, including directly under a
// tile (seen in testing: the destination marker and its label stacked under the Threat and Route-to-safety
// tiles). Asymmetric padding reserves real screen margins approximating the tile ring's footprint on every side,
// so fitBounds keeps the route inside the empty centre instead of wherever the raw bounds happen to fall.
function FitRoute({ route, target }: { route: NonNullable<MapProps['route']>; target: { lat: number; lng: number } }) {
  const map = useMap()
  const key = `${route.destination.name}|${route.updatedAt}`
  useEffect(() => {
    const pts = [...route.geometry.map((p) => [p.lat, p.lng] as [number, number]), [target.lat, target.lng] as [number, number]]
    const bounds = L.latLngBounds(pts)
    if (!map.getBounds().contains(bounds)) {
      map.fitBounds(bounds, { paddingTopLeft: [140, 110], paddingBottomRight: [140, 130], maxZoom: 16 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

const DEST_COLOR = { police: '#2c4a9e', fire: '#b8391f', hospital: '#1f7a45' } as const

// Free fallback (no key, no billing) used when no Google Maps key is configured.
export default function OsmIncidentMap({ rough, confirmed, target, backdrop, track, route }: MapProps) {
  const locked = backdrop
    // Zoom stays available but always around the centre, so the caller stays under the case hub; no panning.
    ? { dragging: false, doubleClickZoom: 'center' as const, touchZoom: 'center' as const, scrollWheelZoom: 'center' as const, boxZoom: false, keyboard: false }
    : { scrollWheelZoom: false }
  const moving = (track?.length ?? 0) > 1
  const current = moving ? track![track!.length - 1] : null
  return (
    <MapContainer className="map" center={[target.lat, target.lng]} zoom={backdrop ? 16 : 15} {...locked}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route && (
        <>
          {/* Route to safety: a soft glow under a bright line, then the destination station. */}
          {/* Navigation-style route: white casing under a solid blue line. */}
          <Polyline positions={route.geometry.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#ffffff', weight: 11, opacity: 1, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
          <Polyline positions={route.geometry.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#1a73e8', weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
          {route.steps[route.stepIndex] && (
            <CircleMarker center={[route.steps[route.stepIndex].lat, route.steps[route.stepIndex].lng]} radius={7} pathOptions={{ color: '#1a73e8', weight: 3, fillColor: '#fff', fillOpacity: 1 }}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="map-turn-label">{route.steps[route.stepIndex].instruction}</Tooltip>
            </CircleMarker>
          )}
          <CircleMarker center={[route.destination.lat, route.destination.lng]} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: DEST_COLOR[route.destination.kind], fillOpacity: 1 }}>
            <Tooltip permanent direction="right" offset={[12, 0]} className="map-dest-label">{route.destination.name}</Tooltip>
          </CircleMarker>
        </>
      )}
      {moving && <Polyline positions={track!.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#0b57d0', weight: 5, opacity: 0.9, dashArray: '1 9', lineCap: 'round' }} interactive={false} />}
      {moving && track!.slice(-12, -1).map((p, k, arr) => (
        <CircleMarker key={`${p.lat},${p.lng},${k}`} center={[p.lat, p.lng]} radius={3 + (k / arr.length) * 3} interactive={false} pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#0b57d0', fillOpacity: 0.35 + (k / arr.length) * 0.6 }} />
      ))}
      {current && <CircleMarker center={[current.lat, current.lng]} radius={24} interactive={false} className="live-pulse" pathOptions={{ stroke: false, fillColor: '#0b57d0', fillOpacity: 0.2 }} />}
      {!moving && rough && (
        <CircleMarker center={[rough.lat, rough.lng]} radius={9} pathOptions={{ color: '#5f6673', fillColor: '#8a919c', fillOpacity: 0.9, weight: 2 }}>
          <Tooltip>Approximate location</Tooltip>
        </CircleMarker>
      )}
      {confirmed && !moving && (
        <>
          {/* Halo + white ring keep the incident pin distinct from the red hospital icons on OSM tiles. */}
          <CircleMarker center={[confirmed.lat, confirmed.lng]} radius={26} interactive={false} pathOptions={{ stroke: false, fillColor: '#c92a2a', fillOpacity: 0.18 }} />
          <CircleMarker center={[confirmed.lat, confirmed.lng]} radius={12} pathOptions={{ color: '#ffffff', fillColor: '#c92a2a', fillOpacity: 1, weight: 4 }}>
            {!backdrop && <Tooltip permanent direction="top" offset={[0, -12]}>Incident</Tooltip>}
          </CircleMarker>
        </>
      )}
      {current && (
        <CircleMarker center={[current.lat, current.lng]} radius={11} pathOptions={{ color: '#ffffff', fillColor: '#2b6cb0', fillOpacity: 1, weight: 4 }}>
          {!backdrop && <Tooltip permanent direction="top" offset={[0, -12]}>Caller (live)</Tooltip>}
        </CircleMarker>
      )}
      <FollowTarget lat={target.lat} lng={target.lng} />
      {route && <FitRoute route={route} target={current ?? target} />}
    </MapContainer>
  )
}
