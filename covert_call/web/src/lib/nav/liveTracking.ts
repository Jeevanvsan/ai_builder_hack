import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { appendTrackPoint, INCIDENTS, setSafeRoute } from '../../../../shared/incidents/client.ts'
import { accuracyOf } from '../../../../shared/incidents/location.ts'
import type { Incident, TrackPoint } from '../../../../shared/incidents/types.ts'
import { bestSafeRoute, distanceM, kindForSituation, progressOnRoute, travelModeFor, type LatLng, type SafeRoute } from '../../../../shared/nav/route.ts'
import { landmarkNear, locateLandmark } from '../../../../shared/nav/nearbyServices.ts'
import { gpsSimEnabled } from '../gpsSim.ts'

const WRITE_EVERY_MS = 10_000
const WRITE_EVERY_M = 30
const REROUTE_MIN_GAP_MS = 20_000
const ROUTE_STALE_MS = 60_000
const TURN_NOTICE_M = 150
const ARRIVED_M = 40

export type LiveTracker = {
  // What Mia says next: computes a route to the best-fit station if none exists, then describes the next step.
  guidance: (situation?: string, landmark?: string) => Promise<string>
  // Starts working out the route in the background (once the caller is known to be on the move), so the
  // directions are ready, or nearly, by the time Mia asks for them.
  prefetch: (situation?: string) => void
  stop: () => void
}

const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`)
// Said after the travel time when the route isn't a car route ("about 6 min on foot"). Car routes say nothing extra,
// as before (and every route is a car route when there's no Google Maps key).
const byMode = (r: SafeRoute) => (r.travelMode === 'WALK' ? ' on foot' : r.travelMode === 'TWO_WHEELER' ? ' by two-wheeler' : '')
// How long the caller's recent fixes are kept for working out their speed, and how recent a "running" motion is.
const SPEED_WINDOW_MS = 30_000
const RUNNING_RECENT_MS = 90_000

// Keeps the caller's live GPS flowing to the incident while the call is open, and keeps a route to safety current
// as they move: tracks progress, re-routes when they leave the route, and nudges Mia before each upcoming turn.
const PRECISE_M = 100
// What a phone fix is recorded as: the demo GPS simulator's fixes are marked so the dashboard can tell them apart.
const FIX_SOURCE: 'gps' | 'sim' = gpsSimEnabled ? 'sim' : 'gps'

export function startLiveTracking(db: Firestore, incidentId: string, onTurnNote: (note: string) => void): LiveTracker {
  let pos: LatLng | null = null
  // Where `pos` came from: a phone fix, or a place the caller named / the address they confirmed ('landmark').
  let posSource: NonNullable<TrackPoint['source']> = FIX_SOURCE
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
  let waitLogged = false
  // After a failed attempt, wait before asking the map servers again (it retried on every incident update).
  let lastFailAt = 0
  const routeIfWanted = () => {
    if (!wantRoute || route || inflight || Date.now() - lastFailAt < 15_000) return
    if (!pos || !(gpsFix || latestIncident?.location.confirmed)) {
      if (!waitLogged) console.info('[QuickBite call] route waiting for a position (GPS fix or confirmed address)')
      waitLogged = true
      return
    }
    console.info('[QuickBite call] working out the route from', pos)
    void reroute(wantRoute).then((r) => {
      if (!r) { lastFailAt = Date.now(); console.warn('[QuickBite call] no route found (retrying in 15 s)') }
      if (r) onTurnNote(`Route to safety is ready: ${r.destination.name} (${r.destination.kind}), ${fmtM(r.distanceM)} away, about ${Math.max(1, Math.round(r.durationS / 60))} min${byMode(r)}. First: ${r.steps[0]?.instruction ?? 'continue ahead'}${r.steps[1] ? `, then ${r.steps[1].instruction}` : ''}. Tell the caller where you are taking them, the first direction and the distance.`)
    })
  }

  // The caller's recent precise fixes, for their speed: walking, riding or in a vehicle picks the route's mode.
  const recentFixes: { at: number; p: LatLng; speed: number | null }[] = []
  // The last situation Mia described when asking for directions ("followed on foot", "I'm in an auto"), kept for
  // re-routes that have no words of their own (the caller left the route, the route went stale).
  let lastSituation: string | null = null
  const currentSpeed = (): number | null => {
    const since = Date.now() - SPEED_WINDOW_MS
    const fixes = recentFixes.filter((f) => f.at >= since)
    const reported = fixes.map((f) => f.speed).filter((s): s is number => s != null && Number.isFinite(s) && s >= 0).sort((a, b) => a - b)
    if (reported.length) return reported[Math.floor(reported.length / 2)]
    // Some phones report no speed: work it out from the first and last fix, if they are far enough apart in time.
    const first = fixes[0], last = fixes.at(-1)
    return first && last && last.at - first.at >= 10_000 ? distanceM(first.p, last.p) / ((last.at - first.at) / 1000) : null
  }
  const travelMode = () => travelModeFor({
    speedMps: currentSpeed(),
    running: (latestIncident?.motionEvents ?? []).some((e) => e.kind === 'running' && Date.now() - Date.parse(e.at) < RUNNING_RECENT_MS),
    situation: lastSituation,
  })

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
        const current = route
        const kind = current?.destination.kind ?? kindForSituation([reason])
        // A station the dispatcher picked stays the destination when the route is re-planned (the caller moved or
        // left the route). This used to check only this call's own argument, which no re-plan ever set, so the
        // periodic re-route quietly swapped the dispatcher's choice for the nearest station of the same kind.
        const keepDestination = current && (requestedBy === 'responder' || current.requestedBy === 'responder')
        const target = keepDestination ? { ...current.destination, distanceKm: 0 } : undefined
        const next = await bestSafeRoute(from, kind, reason, current?.requestedBy ?? requestedBy, target, travelMode())
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
      } catch (err) {
        console.warn('[QuickBite call] route lookup failed:', err)
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
    posSource = FIX_SOURCE
    const now = Date.now()
    recentFixes.push({ at: now, p: pos, speed: p.coords.speed })
    while (recentFixes.length && recentFixes[0].at < now - SPEED_WINDOW_MS) recentFixes.shift()
    routeIfWanted()
    if (!lastWrite || now - lastWrite.at > WRITE_EVERY_MS || distanceM(lastWrite.p, pos) > WRITE_EVERY_M) {
      lastWrite = { at: now, p: pos }
      void appendTrackPoint(db, incidentId, { ...pos, speed: p.coords.speed, accuracyM: accuracyOf(p), source: FIX_SOURCE })
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
    // Arrival: one clear note, and no more turn notes after it (they were still telling a caller who had arrived
    // to "turn right in 100 m", INC-MUZJ14B7).
    if (prog.toDestinationM < ARRIVED_M) {
      if (!arrivedNoted) {
        arrivedNoted = true
        onTurnNote(`ARRIVED: the caller has reached ${route.destination.name}. Stop giving directions. Ask them to confirm they are at the ${route.destination.kind === 'police' ? 'station' : 'entrance'} and safe now.`)
      }
      return
    }
    if (prog.next && prog.toNextM < TURN_NOTICE_M && notedStep !== prog.stepIndex) {
      notedStep = prog.stepIndex
      const r0 = route, next = prog.next, toNext = prog.toNextM, toDest = prog.toDestinationM
      void landmarkAt(next).then((lm) => onTurnNote(`Heading to ${r0.destination.name} (${r0.destination.kind}), ${fmtM(toDest)} to go. Next: ${next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(toNext)}. Tell the caller ALL of it in their language — where they're going and how far, the turn with its road/landmark, and the distance to the turn — then one calming line.`))
    }
  }

  let arrivedNoted = false
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
      posSource = 'landmark'
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
      if (situation) lastSituation = situation
      // No GPS fix yet (desktop, denied, indoors): fall back to the incident's latest known location (IP or a
      // confirmed address) so guidance still works instead of looping on "ask for a landmark".
      if (!pos) {
        pos = await knownLocation()
        if (pos) posSource = 'landmark'
      }
      if (!gpsFix && !latestIncident?.location.confirmed) pos = null
      // Everything the caller reports from here should stay near where they said they were, not wherever GPS
      // happens to be (a device's GPS/IP fix can be tens of km off — this exact mismatch put a caller who said
      // "Alappuzha Vazhicherry" on the map near Muvattupuzha). Once an address is confirmed, it — not GPS — is
      // the anchor every subsequent landmark search is bounded to.
      const known = await knownLocation()
      const anchor = known ?? pos
      const anchorSource = known ? 'landmark' : posSource
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
        // Capped: a slow lookup (Photon took 7 s once) made the whole answer miss its 6 s budget.
        const hit = await Promise.race([locateLandmark(landmark, anchor).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2_500))])
        // The simulated GPS (demo recording) is exact: a landmark the caller names never moves it.
        if (hit && !gpsSimEnabled && (!gpsFix || !pos || distanceM(pos, hit) > GPS_OVERRIDE_M) && distanceM(anchor, hit) > 30) {
          // The dashboard follows a trail of 2+ points, so the first reported landmark also records where they
          // started — from the anchor (what the caller confirmed), not a possibly-wrong GPS/rough fix.
          if (!latestIncident?.location.track?.length) void appendTrackPoint(db, incidentId, { ...anchor, speed: null, source: anchorSource })
          pos = { lat: hit.lat, lng: hit.lng }
          posSource = 'landmark'
          movedTo = hit.name
          if (hit.confidence === 'low') uncertainMatch = hit.name
          void appendTrackPoint(db, incidentId, { ...pos, speed: null, source: 'landmark' })
          if (route) await reroute(route.reason)
        }
      }
      if (!pos) return `No reliable location yet — you MUST ask the caller now where exactly they are (road/area AND town), read it back, and call confirm_address; then call get_route_guidance again. Do not give any directions until then. ${landmark ? `The caller already said: "${landmark}" — do NOT ask for a landmark again; call confirm_address with it.` : 'Ask ONCE for a landmark or junction name.'} Meanwhile tell them to keep moving towards a busy, well-lit place (a shop, petrol pump, crowd).`
      if (!route) await reroute(situation ?? 'caller needs to reach safety')
      if (!route) return 'No route yet (the map servers are slow). Do NOT name a destination, a distance or a turn: you do not have one. Tell them to keep moving towards a busy, well-lit place, ask for a landmark they can see, and say you will guide them in a moment. The route will follow as a system note.'
      const r: SafeRoute = route
      const prog = progressOnRoute(pos, r)
      const after = r.steps[prog.stepIndex + 1]
      // Landmarks only flavour the directions: looked up together, and never allowed to hold them up.
      const within = <T,>(pr: Promise<T>, ms: number) => Promise.race([pr, new Promise<null>((r) => setTimeout(() => r(null), ms))])
      const [lm, here] = await Promise.all([within(landmarkAt(prog.next), 1_500), within(landmarkNear(pos).catch(() => null), 1_500)])
      return [
        `Destination: ${r.destination.name} (${r.destination.kind}), ${fmtM(prog.toDestinationM)} away, about ${Math.max(1, Math.round(r.durationS / 60))} min${byMode(r)}.`,
        prog.next ? `Next: ${prog.next.instruction}${lm ? ` at ${lm}` : ''} in about ${fmtM(prog.toNextM)}.` : '',
        after ? `Then: ${after.instruction}.` : '',
        here ? `Reference landmark near the caller's GPS position (the caller has NOT mentioned it — say "you should see ${here} nearby", never "that ${here}"): ${here}.` : '',
        landmark ? (movedTo
          ? (uncertainMatch
            ? `Caller's position updated to ${movedTo} (from what they reported), but this match is NOT certain — it's a loose or borderline match nearby, not an exact one. Before trusting it, read it back and ask them to confirm: "Is that ${movedTo}, or something else nearby?" If they say it's wrong or unsure, ask for the exact name or a clearer landmark instead of guiding from this position.`
            : `Caller's position updated to ${movedTo} (from what they reported); directions above are from there.`)
          : `Caller reports being at: "${landmark}" — could not find that near their confirmed area, so directions above are still from their last known position. If it still doesn't match what they see, ask for a different nearby landmark or road name (once), rather than assuming they've moved.`) : '',
        "Say it in the caller's language, with the landmark, the direction and the distance; if they ask what is there, describe the landmark and how far the destination is.",
        "If they ask whether to go left, right or straight: you can't see which way they face, so answer with the compass direction and a road or landmark they can see on that side (e.g. 'go south, towards the canal and CCSB Road'), and ask them to tell you when they reach the next road. Never repeat the same sentence.",
      ].filter(Boolean).join(' ')
    },
    prefetch: (situation) => {
      if (situation) lastSituation = situation
      wantRoute ??= situation ?? 'caller needs to reach safety'
      routeIfWanted()
    },
    stop: () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      unsub()
    },
  }
}
