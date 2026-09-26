import { nearbyServices, type NearbyService, type ServiceKind } from './nearbyServices.ts'
import { affirmed } from '../incidents/severity.ts'

// Driving routes via the free public OSRM server (no key, fair-use demo service — fine for a prototype).
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

export type LatLng = { lat: number; lng: number }
export type RouteStep = { instruction: string; distanceM: number; lat: number; lng: number }
export type SafeRoute = {
  destination: { kind: ServiceKind; name: string; lat: number; lng: number; phone: string | null }
  reason: string
  distanceM: number
  durationS: number
  geometry: LatLng[]
  steps: RouteStep[]
  stepIndex: number
  requestedBy: 'ai' | 'responder'
  updatedAt: string
}

type OsrmStep = {
  distance: number
  name: string
  maneuver: { type: string; modifier?: string; location: [number, number] }
}

// OSRM gives structured maneuvers; turn them into short spoken-style instructions.
function instructionOf(s: OsrmStep): string {
  const road = s.name ? ` onto ${s.name}` : ''
  const mod = s.maneuver.modifier ?? ''
  switch (s.maneuver.type) {
    case 'depart': return `Head ${mod || 'forward'}${s.name ? ` on ${s.name}` : ''}`
    case 'arrive': return 'Arrive at the destination'
    case 'roundabout':
    case 'rotary': return `At the roundabout, take the exit${road}`
    case 'fork': return `Keep ${mod || 'straight'} at the fork${road}`
    case 'merge': return `Merge${road}`
    case 'continue':
    case 'new name': return `Continue straight${road}`
    default:
      if (mod.includes('uturn')) return `Make a U-turn${road}`
      if (mod === 'straight') return `Go straight${road}`
      return `Turn ${mod.replace('slight ', 'slightly ').replace('sharp ', 'sharply ')}${road}`
  }
}

export async function drivingRoute(from: LatLng, to: LatLng) {
  const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const r = data.routes?.[0]
  if (!r) return null
  const steps: RouteStep[] = (r.legs?.[0]?.steps ?? []).map((s: OsrmStep) => ({
    instruction: instructionOf(s),
    distanceM: Math.round(s.distance),
    lat: s.maneuver.location[1],
    lng: s.maneuver.location[0],
  }))
  // Firestore rejects nested arrays, so the line is stored as {lat, lng} points, not [lat, lng] pairs.
  const geometry: LatLng[] = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }))
  return { distanceM: Math.round(r.distance), durationS: Math.round(r.duration), steps, geometry }
}

export function kindForSituation(indicators: string[]): ServiceKind {
  const t = affirmed(indicators).join(' ').toLowerCase()
  if (/fire|smoke|gas|explosion/.test(t)) return 'fire'
  if (/injur|blood|bleed|hurt|medical/.test(t)) return 'hospital'
  return 'police'
}

// Nearest stations of the right kind; route to the 3 closest and keep the shortest by driving time. The 3
// candidate routes are requested IN PARALLEL, not one after another — this was the main cause of routing feeling
// slow (up to 3 sequential OSRM round-trips, on top of the Overpass lookup, could add up to several seconds).
export async function bestSafeRoute(from: LatLng, kind: ServiceKind, reason: string, requestedBy: 'ai' | 'responder', target?: NearbyService): Promise<SafeRoute | null> {
  const candidates = target ? [target] : (await nearbyServices(from)).filter((s) => s.kind === kind).slice(0, 3)
  const results = await Promise.all(candidates.map(async (c) => ({ c, r: await drivingRoute(from, c) })))
  let best: SafeRoute | null = null
  for (const { c, r } of results) {
    if (!r) continue
    if (!best || r.durationS < best.durationS) {
      best = { destination: { kind: c.kind, name: c.name, lat: c.lat, lng: c.lng, phone: c.phone }, reason, ...r, stepIndex: 0, requestedBy, updatedAt: new Date().toISOString() }
    }
  }
  return best
}

const R = 6371000
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Where the caller is along the route: the next upcoming step, distance to it, and whether they've left the route.
export function progressOnRoute(pos: LatLng, route: SafeRoute) {
  let nearestGeo = Infinity
  for (const p of route.geometry) nearestGeo = Math.min(nearestGeo, distanceM(pos, p))
  let stepIndex = route.stepIndex
  // Advance past any step the caller has reached (within 30 m).
  while (stepIndex < route.steps.length - 1 && distanceM(pos, route.steps[stepIndex]) < 30) stepIndex += 1
  const next = route.steps[stepIndex]
  return {
    stepIndex,
    next,
    toNextM: next ? Math.round(distanceM(pos, next)) : 0,
    toDestinationM: Math.round(distanceM(pos, route.destination)),
    offRoute: nearestGeo > 80,
  }
}
