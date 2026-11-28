import type { Firestore } from 'firebase/firestore'
import { distanceM } from '../nav/route.ts'
import { appendTrackPoint } from './client.ts'
import { accuracyOf } from './location.ts'
import { PRECISE_M } from './position.ts'

// Same cadence as the live call's tracker (web/src/lib/nav/liveTracking.ts): a point every 10 s, or sooner once the
// caller has moved 30 m.
const EVERY_MS = 10_000
const EVERY_M = 30

export type LocationTrail = { stop: () => void }

// Keeps the caller's position flowing to the incident while a screen with no live call is open: the silent SOS,
// the silent-tap form, and the order-placed screen after a coded order. These used to take one reading when the
// incident started, so a caller who was moved, or kept walking, stayed pinned where they began. Only precise
// fixes are written, as in the live call; nothing here routes or speaks to the caller. `source` is 'sim' while
// the demo GPS simulator stands in for the phone's GPS.
export function startLocationTrail(db: Firestore, id: string, opts: { source?: 'gps' | 'sim' } = {}): LocationTrail {
  const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
  if (!geo) return { stop: () => {} }
  let last: { at: number; lat: number; lng: number } | null = null
  const watchId = geo.watchPosition(
    (p) => {
      const accuracyM = accuracyOf(p)
      if (accuracyM == null || accuracyM > PRECISE_M) return
      const here = { lat: p.coords.latitude, lng: p.coords.longitude }
      const at = Date.now()
      if (last && at - last.at < EVERY_MS && distanceM(last, here) < EVERY_M) return
      last = { at, ...here }
      void appendTrackPoint(db, id, { ...here, speed: p.coords.speed, accuracyM, source: opts.source ?? 'gps' }).catch(() => {})
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 },
  )
  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      geo.clearWatch(watchId)
    },
  }
}
