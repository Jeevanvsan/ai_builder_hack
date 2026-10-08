// Simulated GPS for recording the chase-and-route demo (demo recording only). The call itself is real (real voice,
// Mia, recording, dashboard); only the phone's position is simulated: it starts where you choose, holds there until
// Mia has a route to safety, then moves along exactly that route (the incident's safeRoute) at the chosen speed,
// re-joining a new route whenever she re-plans, and stops at the destination.
//
// Turn on on the caller's phone:  https://quickbite-5cde0.web.app/?demoInject=1&gpsSim=9.4981,76.3388
// (lat,lng of the start point; remembered on that phone until ?gpsSim=0). Speed, pause, jump-ahead and moving the
// start are controlled from /demo-control while the call runs. Without ?gpsSim, the real GPS is used as before.
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { LatLng } from '../../../shared/nav/route.ts'

const KEY = 'qb-gps-sim'
export const DEFAULT_SPEED_KMH = 45

function readStart(): LatLng | null {
  try {
    const q = new URLSearchParams(location.search).get('gpsSim')
    if (q === '0') localStorage.removeItem(KEY)
    else if (q) localStorage.setItem(KEY, q)
    const [lat, lng] = (localStorage.getItem(KEY) ?? '').split(',').map(Number)
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null
  } catch {
    return null
  }
}

const R = 6_371_000
const rad = (d: number) => (d * Math.PI) / 180
export const metres = (a: LatLng, b: LatLng) => {
  const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2))
  const y = rad(b.lat - a.lat)
  return Math.hypot(x, y) * R
}
const lerp = (a: LatLng, b: LatLng, t: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })

type State = { pos: LatLng; route: LatLng[] | null; idx: number; speedKmh: number; paused: boolean; arrived: boolean }
let state: State | null = null
const watchers = new Map<number, PositionCallback>()
let nextId = 1

export const gpsSimEnabled = typeof window !== 'undefined' && readStart() !== null

function fix(): GeolocationPosition {
  const s = state!
  const moving = !!s.route && !s.paused && !s.arrived
  const coords = {
    latitude: s.pos.lat,
    longitude: s.pos.lng,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: moving ? s.speedKmh / 3.6 : 0,
  }
  return { coords: { ...coords, toJSON: () => coords }, timestamp: Date.now(), toJSON: () => ({ coords, timestamp: Date.now() }) } as unknown as GeolocationPosition
}
const emit = () => watchers.forEach((cb) => { try { cb(fix()) } catch { /* the app's own handler */ } })

// Moves `m` metres forward along the route from the current position.
function advance(m: number) {
  const s = state!
  if (!s.route || s.arrived) return
  while (m > 0 && s.idx < s.route.length - 1) {
    const next = s.route[s.idx + 1]
    const left = metres(s.pos, next)
    if (left <= m) { s.pos = next; s.idx++; m -= left } else { s.pos = lerp(s.pos, next, m / left); m = 0 }
  }
  if (s.idx >= s.route.length - 1) s.arrived = true
}

// A new or re-planned route: continue from the nearest point on it (ahead of where we are).
function adoptRoute(geometry: LatLng[]) {
  const s = state!
  if (!geometry.length) return
  let best = 0
  let bestD = Infinity
  geometry.forEach((p, i) => { const d = metres(s.pos, p); if (d < bestD) { bestD = d; best = i } })
  // A route that doesn't pass near the caller was planned from somewhere else (a misplaced landmark): following it
  // would teleport the caller. Keep walking the current route instead.
  if (s.route && bestD > 80) { console.info('[QuickBite demo] ignored a route planned away from the caller', Math.round(bestD), 'm'); return }
  s.route = geometry
  s.idx = best
  s.arrived = false
}

// Replaces navigator.geolocation so the whole app (incident start, live tracking, routing) sees the simulated fix.
if (gpsSimEnabled && navigator.geolocation) {
  state = { pos: readStart()!, route: null, idx: 0, speedKmh: DEFAULT_SPEED_KMH, paused: false, arrived: false }
  const geo = navigator.geolocation as Geolocation & Record<string, unknown>
  geo.getCurrentPosition = (ok: PositionCallback) => { setTimeout(() => ok(fix()), 50) }
  geo.watchPosition = (ok: PositionCallback) => {
    const id = nextId++
    watchers.set(id, ok)
    setTimeout(() => ok(fix()), 50)
    return id
  }
  geo.clearWatch = (id: number) => { watchers.delete(id) }
  let last = Date.now()
  setInterval(() => {
    const now = Date.now()
    if (state && state.route && !state.paused) advance((state.speedKmh / 3.6) * ((now - last) / 1000))
    last = now
    emit()
  }, 1_000)
  console.info('[QuickBite demo] simulated GPS on, starting at', state.pos)
}

export type GpsSimControl = { gpsSpeedKmh?: number; gpsPaused?: boolean; gpsJumpAt?: number; gpsJumpM?: number; gpsSetAt?: number; gpsSet?: LatLng | null; chaseAt?: number }

// Follows the incident's route and the /demo-control settings for this call.
export function watchGpsSim(db: Firestore, incidentId: string, controlCollection: string): () => void {
  if (!state) return () => {}
  let lastGeometry = ''
  let lastJump = 0
  let lastSet = 0
  const unRoute = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    const g = (snap.data()?.safeRoute?.geometry ?? []) as LatLng[]
    const key = g.length ? `${g.length}:${g[0].lat},${g[0].lng}:${g[g.length - 1].lat}` : ''
    if (key && key !== lastGeometry) { lastGeometry = key; adoptRoute(g) }
  }, () => {})
  const unCtl = onSnapshot(doc(db, controlCollection, incidentId), (snap) => {
    if (snap.metadata.fromCache || !snap.exists() || !state) return
    const c = snap.data() as GpsSimControl
    if (typeof c.gpsSpeedKmh === 'number' && c.gpsSpeedKmh > 0) state.speedKmh = c.gpsSpeedKmh
    if (typeof c.gpsPaused === 'boolean') state.paused = c.gpsPaused
    if ((c.gpsJumpAt ?? 0) > lastJump) { lastJump = c.gpsJumpAt!; advance(c.gpsJumpM ?? 150); emit() }
    if ((c.gpsSetAt ?? 0) > lastSet && c.gpsSet) { lastSet = c.gpsSetAt!; state.pos = c.gpsSet; if (state.route) adoptRoute(state.route); emit() }
  }, () => {})
  return () => { unRoute(); unCtl() }
}

export const gpsSimStatus = () => (state ? { ...state.pos, speedKmh: state.speedKmh, paused: state.paused, arrived: state.arrived, onRoute: !!state.route } : null)
