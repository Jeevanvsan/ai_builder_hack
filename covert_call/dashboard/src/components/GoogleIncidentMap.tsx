/// <reference types="google.maps" />
import { useEffect, useMemo } from 'react'
import { AdvancedMarker, APIProvider, Circle, ControlPosition, Map, Polyline, useMap } from '@vis.gl/react-google-maps'
import { GOOGLE_MAP_ID } from '../lib/googleMaps'
import { DEST_COLOR, MIN_RING_M, type MapProps, type MapView } from './mapTypes'

type LatLng = { lat: number; lng: number }

function FollowTarget({ lat, lng }: LatLng) {
  const map = useMap()
  useEffect(() => {
    map?.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
}

// The board backdrop zooms only around its centre, so the caller stays under the case hub (as on the OSM map):
// the wheel and a double-click step the zoom; dragging and pinching are off (gestureHandling 'none').
function CentreZoom() {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const el = map.getDiv()
    let last = 0
    const step = (dz: number) => map.setZoom(Math.max(3, Math.min(20, (map.getZoom() ?? 16) + dz)))
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (Date.now() - last < 250) return
      last = Date.now()
      step(e.deltaY < 0 ? 1 : -1)
    }
    const onDblClick = () => step(1)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dblclick', onDblClick)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDblClick)
    }
  }, [map])
  return null
}

// The largest zoom at which every point fits in widthPx x heightPx (Web Mercator, 256 px tiles).
function zoomToFit(points: LatLng[], widthPx: number, heightPx: number): number {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const y = (lat: number) => Math.atanh(Math.sin((lat * Math.PI) / 180))
  const latFraction = (y(Math.max(...lats)) - y(Math.min(...lats))) / (2 * Math.PI)
  const lngFraction = (Math.max(...lngs) - Math.min(...lngs)) / 360
  const fit = (px: number, fraction: number) => (fraction > 0 ? Math.log2(px / 256 / fraction) : Infinity)
  return Math.min(fit(widthPx, lngFraction), fit(heightPx, latFraction))
}

// Zooms out just enough to show the whole route (plus the caller), once per new route, as the OSM map does. On the
// board backdrop the caller stays at the centre under the hub, so it picks the zoom at which the route, mirrored
// around the caller, fits inside the area the evidence tiles leave clear, rather than re-centring on the route.
function FitRoute({ route, target, backdrop }: { route: NonNullable<MapProps['route']>; target: LatLng; backdrop?: boolean }) {
  const map = useMap()
  const key = `${route.destination.name}|${route.updatedAt}`
  useEffect(() => {
    if (!map) return
    const pts: LatLng[] = [...route.geometry, target]
    if (!backdrop) {
      const bounds = new google.maps.LatLngBounds()
      pts.forEach((p) => bounds.extend(p))
      const view = map.getBounds()
      if (view && view.contains(bounds.getNorthEast()) && view.contains(bounds.getSouthWest())) return
      map.fitBounds(bounds, 60)
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16)
      })
      return
    }
    const div = map.getDiv()
    if (!div.clientWidth || !div.clientHeight) return
    const mirrored = pts.map((p) => ({ lat: 2 * target.lat - p.lat, lng: 2 * target.lng - p.lng }))
    // Keep clear of the tile columns (about a quarter of the width each side) and the top and bottom tile rows.
    const zoom = zoomToFit([...pts, ...mirrored], div.clientWidth * 0.55, div.clientHeight * 0.6)
    map.setCenter(target)
    map.setZoom(Math.max(12, Math.min(16, Math.floor(zoom))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

// A line of dots (the OSM map's dashed round-capped line). Its own component: the dot symbol comes from the Maps
// script, which only exists once the map has loaded and started rendering its children.
function DottedTrail({ path }: { path: LatLng[] }) {
  const icons = useMemo(() => [{ icon: { path: google.maps.SymbolPath.CIRCLE, scale: 2.5, fillColor: '#0b57d0', fillOpacity: 0.9, strokeOpacity: 0 }, offset: '0', repeat: '10px' }], [])
  return <Polyline path={path} strokeOpacity={0} zIndex={3} clickable={false} icons={icons} />
}

// A round marker drawn in HTML, centred on its position, with an optional always-on label (the Leaflet tooltips).
function Dot({ position, size, fill, ring, ringWidth, label, labelSide = 'top', title, zIndex, className }: {
  position: LatLng
  size: number
  fill: string
  ring: string
  ringWidth: number
  label?: string
  labelSide?: 'top' | 'right'
  title?: string
  zIndex?: number
  className?: string
}) {
  return (
    <AdvancedMarker position={position} anchorLeft="-50%" anchorTop="-50%" zIndex={zIndex} title={title} clickable={false}>
      <div className={`gm-marker${className ? ` ${className}` : ''}`}>
        <span className="gm-dot" style={{ width: size, height: size, background: fill, border: `${ringWidth}px solid ${ring}` }} />
        {label && <span className={`gm-label gm-label-${labelSide}`}>{label}</span>}
      </div>
    </AdvancedMarker>
  )
}

export default function GoogleIncidentMap({ rough, confirmed, target, live, backdrop, track, route, apiKey, view = 'map' }: MapProps & { apiKey: string; view?: Exclude<MapView, '3d'> }) {
  // `moving` draws the trail (needs 2+ points); the live caller marker shows from the first live point on, since
  // one reported landmark already means the caller is no longer at the confirmed address.
  const moving = (track?.length ?? 0) > 1
  const current = live ? target : null
  const trailKey = track?.length ? `${track.length}|${track.at(-1)!.at}` : ''
  const trail = useMemo(() => (track ?? []).map((p) => ({ lat: p.lat, lng: p.lng })), [trailKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const recent = moving ? track!.slice(-12, -1) : []
  const routePath = useMemo(() => route?.geometry.map((p) => ({ lat: p.lat, lng: p.lng })) ?? [], [route?.updatedAt, route?.destination.name]) // eslint-disable-line react-hooks/exhaustive-deps
  const turn = route?.steps[route.stepIndex]
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        className="map"
        mapId={GOOGLE_MAP_ID}
        defaultCenter={{ lat: target.lat, lng: target.lng }}
        defaultZoom={backdrop ? 16 : 15}
        mapTypeId={view === 'satellite' ? 'hybrid' : 'roadmap'}
        disableDefaultUI
        zoomControl
        zoomControlOptions={{ position: ControlPosition.LEFT_BOTTOM }}
        gestureHandling={backdrop ? 'none' : 'cooperative'}
        disableDoubleClickZoom={backdrop}
        keyboardShortcuts={!backdrop}
        clickableIcons={false}
      >
        {route && (
          <>
            {/* Navigation-style route: white casing under a solid blue line. */}
            <Polyline path={routePath} strokeColor="#ffffff" strokeWeight={11} strokeOpacity={1} zIndex={1} clickable={false} />
            <Polyline path={routePath} strokeColor="#1a73e8" strokeWeight={7} strokeOpacity={1} zIndex={2} clickable={false} />
            {turn && <Dot position={turn} size={14} fill="#fff" ring="#1a73e8" ringWidth={3} label={turn.instruction} className="gm-turn" zIndex={20} />}
            <Dot position={route.destination} size={22} fill={DEST_COLOR[route.destination.kind]} ring="#fff" ringWidth={3} label={route.destination.name} labelSide="right" className="gm-dest" zIndex={21} />
          </>
        )}
        {/* The caller's trail: a dotted line, and the last few points fading in towards the present. */}
        {moving && <DottedTrail path={trail} />}
        {recent.map((p, k) => (
          p.source === 'landmark'
            // A place the caller named, not a GPS fix: a hollow ring, so it isn't read as a measured position.
            ? <Dot key={`${p.at}|${k}`} position={p} size={12} fill="#fff" ring="#0b57d0" ringWidth={2.5} title="Place the caller named" zIndex={10} />
            : <Dot key={`${p.at}|${k}`} position={p} size={6 + (k / recent.length) * 6} fill={`rgba(11, 87, 208, ${0.35 + (k / recent.length) * 0.6})`} ring="#fff" ringWidth={1.5} zIndex={10} />
        ))}
        {/* How far off the phone's fix may be: the caller is somewhere inside this ring. */}
        {current && target.accuracyM != null && target.accuracyM >= MIN_RING_M && (
          <Circle center={current} radius={target.accuracyM} strokeColor="#0b57d0" strokeOpacity={0.45} strokeWeight={1} fillColor="#0b57d0" fillOpacity={0.07} clickable={false} zIndex={0} />
        )}
        {!current && !confirmed && rough && (
          <>
            {rough.accuracyM != null && rough.accuracyM >= MIN_RING_M && (
              <Circle center={rough} radius={rough.accuracyM} strokeColor="#5f6673" strokeOpacity={0.5} strokeWeight={1} fillColor="#8a919c" fillOpacity={0.1} clickable={false} zIndex={0} />
            )}
            <Dot
              position={rough}
              size={18}
              fill="#8a919c"
              ring="#5f6673"
              ringWidth={2}
              title={rough.source === 'gps' ? `Approximate location (GPS${rough.accuracyM != null ? ` ±${rough.accuracyM} m` : ''})` : 'Approximate location (IP estimate, can be km off)'}
              zIndex={30}
            />
          </>
        )}
        {confirmed && !current && (
          <AdvancedMarker position={confirmed} anchorLeft="-50%" anchorTop="-50%" zIndex={40} title={confirmed.address} clickable={false}>
            {/* Halo + white ring keep the incident pin distinct from the map's own red icons. */}
            <div className="gm-marker gm-incident">
              <span className="gm-halo" />
              <span className="gm-dot" style={{ width: 24, height: 24, background: '#c92a2a', border: '4px solid #fff' }} />
              {!backdrop && <span className="gm-label gm-label-top">Incident</span>}
            </div>
          </AdvancedMarker>
        )}
        {current && (
          <AdvancedMarker position={current} anchorLeft="-50%" anchorTop="-50%" zIndex={50} title="Caller (live)" clickable={false}>
            <div className="gm-marker gm-caller">
              <span className="gm-pulse" />
              <span className="gm-dot" style={{ width: 22, height: 22, background: '#2b6cb0', border: '4px solid #fff' }} />
              {!backdrop && <span className="gm-label gm-label-top">Caller (live)</span>}
            </div>
          </AdvancedMarker>
        )}
        <FollowTarget lat={target.lat} lng={target.lng} />
        {backdrop && <CentreZoom />}
        {route && <FitRoute route={route} target={target} backdrop={backdrop} />}
      </Map>
    </APIProvider>
  )
}
