import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { appendTrackPoint, INCIDENTS, setSafeRoute } from '../../../../shared/incidents/client.ts'
import type { Incident } from '../../../../shared/incidents/types.ts'
import { bestSafeRoute, distanceM, kindForSituation, progressOnRoute, type LatLng, type SafeRoute } from '../../../../shared/nav/route.ts'
import { landmarkNear } from '../../../../shared/nav/nearbyServices.ts'

const WRITE_EVERY_MS = 10_000
const WRITE_EVERY_M = 30
const REROUTE_MIN_GAP_MS = 20_000
const ROUTE_STALE_MS = 60_000
const TURN_NOTICE_M = 150

export type LiveTracker = {
  // What Mia says next: computes a route to the best-fit station if none exists, then describes the next step.
  guidance: (situation?: string, landmark?: string) => Promise<string>
  stop: () => void
}

const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`)

// Keeps the caller's live GPS flowing to the incident while the call is open, and keeps a route to safety current
// as they move: tracks progress, re-routes when they leave the route, and nudges Mia before each upcoming turn.
export function startLiveTracking(db: Firestore, incidentId: string, onTurnNote: (note: string) => void): LiveTracker {
  let pos: LatLng | null = null
  let lastWrite: { at: number; p: LatLng } | null = null
  let route: SafeRoute | null = null
  let lastRouteAt = 0
  let notedStep = -1
  let rerouting = false

  const adopt = (r: SafeRoute) => {
    route = r
    lastRouteAt = Date.now()
    notedStep = -1
  }

  const reroute = async (reason: string, requestedBy: 'ai' | 'responder' = 'ai') => {
    if (!pos || rerouting) return route
    rerouting = true
    try {
      const kind = route?.destination.kind ?? kindForSituation([reason])
      const target = route && requestedBy === 'responder' ? { ...route.destination, distanceKm: 0 } : undefined
      const next = await bestSafeRoute(pos, kind, reason, route?.requestedBy ?? requestedBy, target)
      if (next) {
        adopt(next)
        await setSafeRoute(db, incidentId, next)
      }
      return route
    } finally {
      rerouting = false
    }
  }

  const onFix = (p: GeolocationPosition) => {
    pos = { lat: p.coords.latitude, lng: p.coords.longitude }
    const now = Date.now()
    if (!lastWrite || now - lastWrite.at > WRITE_EVERY_MS || distanceM(lastWrite.p, pos) > WRITE_EVERY_M) {
      lastWrite = { at: now, p: pos }
      void appendTrackPoint(db, incidentId, { ...pos, speed: p.coords.speed })
    }
    if (!route) return
    const prog = progressOnRoute(pos, route)
    if ((prog.offRoute || now - lastRouteAt > ROUTE_STALE_MS) && now - lastRouteAt > REROUTE_MIN_GAP_MS) {
      void reroute(prog.offRoute ? 'caller left the route' : route.reason).then((r) => {
        if (r && prog.offRoute) onTurnNote(`The caller left the route — new route: ${r.steps[0]?.instruction ?? 'continue'}, ${fmtM(r.distanceM)} to ${r.destination.name}.`)
      })
      return
    }
    if (prog.stepIndex !== route.stepIndex) {
      route = { ...route, stepIndex: prog.stepIndex }
      void setSafeRoute(db, incidentId, route)
    }
    if (prog.next && prog.toNextM < TURN_NOTICE_M && notedStep !== prog.stepIndex) {
      notedStep = prog.stepIndex
      const r0 = route, next = prog.next, toNext = prog.toNextM, toDest = prog.toDestinationM
      void landmarkAt(next).then((lm) => onTurnNote(`Next: ${next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(toNext)}. ${fmtM(toDest)} to ${r0.destination.name}. Relay it in the caller's language, with the landmark if there is one, then one calming line.`))
    }
  }

  const watchId = navigator.geolocation?.watchPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 })

  // A responder can pick a different station on the dashboard; follow it.
  const unsub = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    const r = (snap.data() as Incident | undefined)?.safeRoute
    if (r && r.requestedBy === 'responder' && r.updatedAt !== route?.updatedAt && r.destination.name !== route?.destination.name) {
      adopt(r)
      onTurnNote(`The dispatcher changed the destination to ${r.destination.name}. Next: ${r.steps[0]?.instruction ?? 'continue'}.`)
    }
  })

  // Landmark lookups are cached per turn point so repeated guidance calls don't re-query.
  const lmCache = new Map<string, Promise<string | null>>()
  function landmarkAt(step: { lat: number; lng: number } | null | undefined) {
    if (!step) return Promise.resolve(null)
    const k = `${step.lat},${step.lng}`
    if (!lmCache.has(k)) lmCache.set(k, landmarkNear(step).catch(() => null))
    return lmCache.get(k)!
  }

  return {
    guidance: async (situation, landmark) => {
      if (!pos) return 'No GPS fix from the caller yet — ask for a nearby landmark or junction name instead.'
      if (!route) await reroute(situation ?? 'caller needs to reach safety')
      if (!route) return 'Could not find a route right now — ask for the nearest landmark and keep them moving somewhere busy and lit.'
      const r: SafeRoute = route
      const prog = progressOnRoute(pos, r)
      const after = r.steps[prog.stepIndex + 1]
      const lm = await landmarkAt(prog.next)
      const here = await landmarkNear(pos)
      return [
        `Destination: ${r.destination.name} (${r.destination.kind}), ${fmtM(prog.toDestinationM)} away, about ${Math.max(1, Math.round(r.durationS / 60))} min.`,
        prog.next ? `Next: ${prog.next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(prog.toNextM)}.` : '',
        after ? `Then: ${after.instruction}.` : '',
        here ? `Near the caller now: ${here}.` : '',
        landmark ? `Caller reports being at: ${landmark}.` : '',
        "Say it in the caller's language, with the landmark, the direction and the distance; if they ask what is there, describe the landmark and how far the destination is.",
      ].filter(Boolean).join(' ')
    },
    stop: () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      unsub()
    },
  }
}
