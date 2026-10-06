import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { appendTrackPoint, INCIDENTS, setSafeRoute } from '../../../../shared/incidents/client.ts'
import type { Incident } from '../../../../shared/incidents/types.ts'
import { bestSafeRoute, distanceM, kindForSituation, progressOnRoute, type LatLng, type SafeRoute } from '../../../../shared/nav/route.ts'
import { landmarkNear, locateLandmark } from '../../../../shared/nav/nearbyServices.ts'

const WRITE_EVERY_MS = 10_000
const WRITE_EVERY_M = 30
const REROUTE_MIN_GAP_MS = 20_000
const ROUTE_STALE_MS = 60_000
const TURN_NOTICE_M = 150

export type LiveTracker = {
  // What Mia says next: computes a route to the best-fit station if none exists, then describes the next step.
  guidance: (situation?: string, landmark?: string) => Promise<string>
  // Starts working out the route in the background (once the caller is known to be on the move), so the
  // directions are ready, or nearly, by the time Mia asks for them.
  prefetch: (situation?: string) => void
  stop: () => void
}

const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`)

// Keeps the caller's live GPS flowing to the incident while the call is open, and keeps a route to safety current
// as they move: tracks progress, re-routes when they leave the route, and nudges Mia before each upcoming turn.
const PRECISE_M = 100

export function startLiveTracking(db: Firestore, incidentId: string, onTurnNote: (note: string) => void): LiveTracker {
  let pos: LatLng | null = null
  let lastWrite: { at: number; p: LatLng } | null = null
  let route: SafeRoute | null = null
  let lastRouteAt = 0
  let notedStep = -1
  // The route request in flight, shared: a guidance call made while a prefetch is running waits for that same
  // request instead of getting "no route".
  let inflight: Promise<SafeRoute | null> | null = null
  // Set once the caller is known to be on the move. The route used to be worked out only when Mia called
  // get_route_guidance, and she sometimes never did ("I'm guiding you to the police station" with no route,
  // INC-MUWKHLNF), or the caller was reported moving before any position existed. Now the route starts as soon
  // as both are true, and is handed to Mia as a navigation note.
  let wantRoute: string | null = null
  const routeIfWanted = () => {
    if (!wantRoute || route || inflight || !pos || !(gpsFix || latestIncident?.location.confirmed)) return
    void reroute(wantRoute).then((r) => {
      if (r) onTurnNote(`Route to safety is ready: ${r.destination.name} (${r.destination.kind}), ${fmtM(r.distanceM)} away, about ${Math.max(1, Math.round(r.durationS / 60))} min. First: ${r.steps[0]?.instruction ?? 'continue ahead'}${r.steps[1] ? `, then ${r.steps[1].instruction}` : ''}. Tell the caller where you are taking them, the first direction and the distance.`)
    })
  }

  const adopt = (r: SafeRoute) => {
    route = r
    lastRouteAt = Date.now()
    notedStep = -1
  }

  const reroute = (reason: string, requestedBy: 'ai' | 'responder' = 'ai'): Promise<SafeRoute | null> => {
    if (!pos) return Promise.resolve(route)
    if (inflight) return inflight
    const from = pos
    inflight = (async () => {
      try {
        const kind = route?.destination.kind ?? kindForSituation([reason])
        const target = route && requestedBy === 'responder' ? { ...route.destination, distanceKm: 0 } : undefined
        const next = await bestSafeRoute(from, kind, reason, route?.requestedBy ?? requestedBy, target)
        if (next) {
          adopt(next)
          // Not awaited: Mia's directions don't wait on the dashboard write.
          void setSafeRoute(db, incidentId, next).catch((err) => {
            // INC-MUWJYDV8: Mia had the route but the dashboard never got it. Say why, and try once more.
            console.warn('[QuickBite call] safe route not saved, retrying:', err)
            setTimeout(() => void setSafeRoute(db, incidentId, route ?? next).catch((e) => console.warn('[QuickBite call] safe route save failed again:', e)), 2_000)
          })
          console.info('[QuickBite call] route:', next.destination.name, `${next.distanceM} m`)
        }
        return route
      } catch {
        return route
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  const onFix = (p: GeolocationPosition) => {
    // Laptop/Wi-Fi fixes can be kilometres off (one put an Alappuzha caller near Kothamangalam). Only a precise
    // fix (phone GPS) drives routing; otherwise the caller's confirmed address does.
    if (p.coords.accuracy > PRECISE_M) {
      if (!gpsFix && !latestIncident?.location.confirmed) pos = null
      return
    }
    gpsFix = true
    pos = { lat: p.coords.latitude, lng: p.coords.longitude }
    routeIfWanted()
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
      void landmarkAt(next).then((lm) => onTurnNote(`Heading to ${r0.destination.name} (${r0.destination.kind}), ${fmtM(toDest)} to go. Next: ${next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(toNext)}. Tell the caller ALL of it in their language — where they're going and how far, the turn with its road/landmark, and the distance to the turn — then one calming line.`))
    }
  }

  const watchId = navigator.geolocation?.watchPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 })

  // A responder can pick a different station on the dashboard; follow it.
  const unsub = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    latestIncident = snap.data() as Incident | undefined
    // No GPS: when the caller's address gets confirmed (or corrected), route from there instead. Only a
    // genuinely geocoded address (real lat/lng) is trusted — one that failed to geocode has no coordinates at
    // all now (see confirmAddress()), rather than silently falling back to the unreliable IP-based rough fix.
    const c = latestIncident?.location.confirmed
    if (!gpsFix && c && c.lat != null && c.lng != null && (!pos || distanceM(pos, { lat: c.lat, lng: c.lng }) > 150)) {
      pos = { lat: c.lat, lng: c.lng }
      routeIfWanted()
      if (route) void reroute(route.reason).then((r) => r && onTurnNote(`Route updated from the confirmed address: ${fmtM(r.distanceM)} to ${r.destination.name}. Next: ${r.steps[0]?.instruction ?? 'continue'}.`))
    }
    const r = latestIncident?.safeRoute
    if (r && r.requestedBy === 'responder' && r.updatedAt !== route?.updatedAt && r.destination.name !== route?.destination.name) {
      adopt(r)
      onTurnNote(`The dispatcher changed the destination to ${r.destination.name}. Next: ${r.steps[0]?.instruction ?? 'continue'}.`)
    }
  })

  let latestIncident: Incident | undefined
  let gpsFix = false
  // Without GPS, only a CONFIRMED address is trusted for routing. The rough location is IP-based and can be tens
  // of km off (it put a Muhamma caller in Kochi), which routed them to the wrong city's police station.
  async function knownLocation(): Promise<LatLng | null> {
    const c = latestIncident?.location.confirmed
    return c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null
  }

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
      // No GPS fix yet (desktop, denied, indoors): fall back to the incident's latest known location (IP or a
      // confirmed address) so guidance still works instead of looping on "ask for a landmark".
      if (!pos) pos = await knownLocation()
      if (!gpsFix && !latestIncident?.location.confirmed) pos = null
      // Everything the caller reports from here should stay near where they said they were, not wherever GPS
      // happens to be (a device's GPS/IP fix can be tens of km off — this exact mismatch put a caller who said
      // "Alappuzha Vazhicherry" on the map near Muvattupuzha). Once an address is confirmed, it — not GPS — is
      // the anchor every subsequent landmark search is bounded to.
      const anchor = (await knownLocation()) ?? pos
      // A named landmark is searched every time the caller reports one, GPS or not — GPS/IP fixes have already
      // proven unreliable enough this session (tens of km off in testing) that a real, named place the caller can
      // see is often better evidence of where they are than the device fix. Without GPS, the landmark simply
      // becomes the position. With GPS, only override it if the landmark disagrees by more than normal GPS
      // jitter/driving distance (800 m) — small disagreement is expected while moving and GPS wins; a large one
      // means the device fix has drifted and the landmark the caller can actually see should be trusted instead.
      const GPS_OVERRIDE_M = 800
      let movedTo: string | null = null
      let uncertainMatch: string | null = null
      if (landmark && anchor) {
        const hit = await locateLandmark(landmark, anchor).catch(() => null)
        if (hit && (!gpsFix || !pos || distanceM(pos, hit) > GPS_OVERRIDE_M) && distanceM(anchor, hit) > 30) {
          // The dashboard follows a trail of 2+ points, so the first reported landmark also records where they
          // started — from the anchor (what the caller confirmed), not a possibly-wrong GPS/rough fix.
          if (!latestIncident?.location.track?.length) void appendTrackPoint(db, incidentId, { ...anchor, speed: null })
          pos = { lat: hit.lat, lng: hit.lng }
          movedTo = hit.name
          if (hit.confidence === 'low') uncertainMatch = hit.name
          void appendTrackPoint(db, incidentId, { ...pos, speed: null })
          if (route) await reroute(route.reason)
        }
      }
      if (!pos) return `No reliable location yet — you MUST ask the caller now where exactly they are (road/area AND town), read it back, and call confirm_address; then call get_route_guidance again. Do not give any directions until then. ${landmark ? `The caller already said: "${landmark}" — do NOT ask for a landmark again; call confirm_address with it.` : 'Ask ONCE for a landmark or junction name.'} Meanwhile tell them to keep moving towards a busy, well-lit place (a shop, petrol pump, crowd).`
      if (!route) await reroute(situation ?? 'caller needs to reach safety')
      if (!route) return 'Could not find a route right now — ask for the nearest landmark and keep them moving somewhere busy and lit.'
      const r: SafeRoute = route
      const prog = progressOnRoute(pos, r)
      const after = r.steps[prog.stepIndex + 1]
      // Landmarks only flavour the directions: looked up together, and never allowed to hold them up.
      const within = <T,>(pr: Promise<T>, ms: number) => Promise.race([pr, new Promise<null>((r) => setTimeout(() => r(null), ms))])
      const [lm, here] = await Promise.all([within(landmarkAt(prog.next), 1_500), within(landmarkNear(pos).catch(() => null), 1_500)])
      return [
        `Destination: ${r.destination.name} (${r.destination.kind}), ${fmtM(prog.toDestinationM)} away, about ${Math.max(1, Math.round(r.durationS / 60))} min.`,
        prog.next ? `Next: ${prog.next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(prog.toNextM)}.` : '',
        after ? `Then: ${after.instruction}.` : '',
        here ? `Reference landmark near the caller's GPS position (the caller has NOT mentioned it — say "you should see ${here} nearby", never "that ${here}"): ${here}.` : '',
        landmark ? (movedTo
          ? (uncertainMatch
            ? `Caller's position updated to ${movedTo} (from what they reported), but this match is NOT certain — it's a loose or borderline match nearby, not an exact one. Before trusting it, read it back and ask them to confirm: "Is that ${movedTo}, or something else nearby?" If they say it's wrong or unsure, ask for the exact name or a clearer landmark instead of guiding from this position.`
            : `Caller's position updated to ${movedTo} (from what they reported); directions above are from there.`)
          : `Caller reports being at: "${landmark}" — could not find that near their confirmed area, so directions above are still from their last known position. If it still doesn't match what they see, ask for a different nearby landmark or road name (once), rather than assuming they've moved.`) : '',
        "Say it in the caller's language, with the landmark, the direction and the distance; if they ask what is there, describe the landmark and how far the destination is.",
      ].filter(Boolean).join(' ')
    },
    prefetch: (situation) => {
      wantRoute ??= situation ?? 'caller needs to reach safety'
      routeIfWanted()
    },
    stop: () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      unsub()
    },
  }
}
