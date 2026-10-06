import type { Incident } from '../../../shared/incidents/types'
import { distanceM, type SafeRoute } from '../../../shared/nav/route.ts'

export type LivePosition = { lat: number; lng: number; at: string | null; source: 'track' | 'address' | 'rough' }

// The caller's best current position: whichever of the live track and the confirmed address is newer, then the
// rough fix. The map, the location tile and the route tile all read this, so they can't disagree about where the
// caller is (previously the map followed the track while the location tile only ever read the confirmed address).
// A confirmed address keeps the pin until the track shows the caller has really moved since they gave it: GPS
// points that stay where the phone was when the address was confirmed are the same place again (often a less
// accurate fix of it), not a move. Previously any newer GPS point won, so a caller who said "Convent Square
// Junction" was pinned there, then snapped back to the call-start GPS spot a few seconds later.
const MOVED_SINCE_ADDRESS_M = 150

export function livePosition(loc: Incident['location']): LivePosition | null {
  const track = loc.track ?? []
  const last = track.at(-1) ?? null
  const c = loc.confirmed
  const pinned = c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng, at: c.confirmedAt } : null
  if (last && pinned && Date.parse(last.at) >= Date.parse(pinned.at)) {
    const pinnedAt = Date.parse(pinned.at)
    // Where the track was when the address was confirmed (or its first point after, if it started later).
    const base = [...track].reverse().find((t) => Date.parse(t.at) <= pinnedAt) ?? track.find((t) => Date.parse(t.at) >= pinnedAt)
    if (base && distanceM(base, last) >= MOVED_SINCE_ADDRESS_M) return { lat: last.lat, lng: last.lng, at: last.at, source: 'track' }
    return { ...pinned, source: 'address' }
  }
  if (last && !pinned) return { lat: last.lat, lng: last.lng, at: last.at, source: 'track' }
  if (pinned) return { ...pinned, source: 'address' }
  // The caller gave an address but it couldn't be placed ("MiG showroom" with no area): show the rough fix rather
  // than an empty map. It's marked 'rough' (approximate area), and the location card says the address couldn't be
  // pinned, so a responder isn't misled by an IP fix that can be tens of km off.
  return loc.rough ? { lat: loc.rough.lat, lng: loc.rough.lng, at: null, source: 'rough' } : null
}

export type RouteProgress = { stepIndex: number; remainingM: number; remainingS: number; arrived: boolean }

// Progress is recomputed here from the caller's latest position, not only read from the stored route. The
// caller's phone only writes progress back when it has a precise GPS fix, so a caller moving by reported
// landmarks (or with a poor fix) left the tile frozen at the route's original distance and first turn.
// Measured along the route line itself: snap the caller to the nearest point of the route geometry, sum the line
// from there to the end, and take the first turn that lies beyond that point as "next". (Counting whole steps
// instead stayed at the full distance until the caller was within 30 m of a turn point.)
function nearestIndex(pts: { lat: number; lng: number }[], p: { lat: number; lng: number }): number {
  let best = 0
  let bestD = Infinity
  for (let k = 0; k < pts.length; k++) {
    const d = distanceM(p, pts[k])
    if (d < bestD) { bestD = d; best = k }
  }
  return best
}

export function routeProgress(route: SafeRoute, pos: LivePosition | null): RouteProgress {
  const g = route.geometry
  if (!pos || pos.source === 'rough' || g.length < 2) {
    return { stepIndex: route.stepIndex, remainingM: route.distanceM, remainingS: route.durationS, arrived: false }
  }
  const idx = nearestIndex(g, pos)
  let remainingM = distanceM(pos, g[idx])
  for (let k = idx; k < g.length - 1; k++) remainingM += distanceM(g[k], g[k + 1])
  remainingM = Math.min(route.distanceM, Math.round(remainingM))
  const upcoming = route.steps.findIndex((s, k) => k > 0 && nearestIndex(g, s) > idx)
  const stepIndex = upcoming === -1 ? route.steps.length - 1 : upcoming
  const remainingS = route.distanceM > 0 ? Math.round(route.durationS * (remainingM / route.distanceM)) : 0
  const arrived = Math.min(distanceM(pos, route.destination), distanceM(pos, g[g.length - 1])) < 50
  return { stepIndex, remainingM, remainingS, arrived }
}
