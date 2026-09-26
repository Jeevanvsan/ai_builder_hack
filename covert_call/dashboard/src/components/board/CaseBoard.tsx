import { useEffect, useRef, useState } from 'react'
import { db } from '../../lib/firebase'
import { setSafeRoute } from '../../../../shared/incidents/client.ts'
import { bestSafeRoute } from '../../../../shared/nav/route.ts'
import DecodeText from './DecodeText'
import { Link } from 'react-router-dom'
import type { Incident } from '../../../../shared/incidents/types'
import IncidentMap from '../IncidentMap'
import { deriveEvidence, SLOT_OF, type Evidence, type EvidenceKind } from '../../lib/evidence'
import { nearbyServices, suggestedServiceKind, type NearbyService } from '../../../../shared/nav/nearbyServices.ts'
import CaseHub from './CaseHub'
import EvidenceTile from './EvidenceTile'
import LightLinks from './LightLinks'
import StressWave from './StressWave'

const ORDER: EvidenceKind[] = ['vehicle', 'location', 'subjects', 'threat', 'stress', 'seen', 'nearby', 'linked']
const SERVICE_LABEL = { police: 'Police', fire: 'Fire', hospital: 'Hospital' } as const

// Nearby help is looked up once per confirmed location. Keyed by coordinates, so a changed address reads as
// "searching" again without an effect having to reset state first.
function useNearby(confirmed: Incident['location']['confirmed']) {
  const lat = confirmed?.lat
  const lng = confirmed?.lng
  const key = lat != null && lng != null ? `${lat},${lng}` : null
  const [result, setResult] = useState<{ key: string; services: NearbyService[] | 'error' } | null>(null)
  useEffect(() => {
    if (lat == null || lng == null || !key) return
    let cancelled = false
    nearbyServices({ lat, lng })
      .then((services) => !cancelled && setResult({ key, services }))
      .catch(() => !cancelled && setResult({ key, services: 'error' }))
    return () => { cancelled = true }
  }, [key, lat, lng])
  if (!key) return null
  return result?.key === key ? result.services : 'pending'
}

// The case board: the live map is the surface, the case hub sits on the incident pin at its centre, and evidence
// tiles occupy fixed slots around the hub, linked to it by light lines. Only tiles with real data are rendered.
export default function CaseBoard({ incident, live, now, timer }: { incident: Incident; live: boolean; now: number; timer: string }) {
  const boardRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const tileEls = useRef(new Map<string, HTMLElement>())
  const nearby = useNearby(incident.location.confirmed)

  const evidence = deriveEvidence(incident, now)
  if (nearby === 'pending') {
    evidence.nearby = { kind: 'nearby', label: 'Nearby help', values: [], tone: 'neutral', pending: 'Finding nearby police, fire and hospital…' }
  } else if (Array.isArray(nearby)) {
    evidence.nearby = { kind: 'nearby', label: 'Nearby help', values: [], tone: 'live', sub: nearby.length ? undefined : 'No stations within 5 km' }
  }

  const route = incident.safeRoute
  if (route) evidence.nearby = { kind: 'nearby', label: 'Route to safety', values: [], tone: 'live' }

  // Responder picks a station: route from the caller's latest position; the caller's app follows it live.
  const routeTo = async (s: NearbyService) => {
    const t = incident.location.track?.at(-1) ?? incident.location.confirmed ?? incident.location.rough
    if (!t) return
    const r = await bestSafeRoute({ lat: t.lat, lng: t.lng }, s.kind, 'Responder chose this station', 'responder', s)
    if (r) await setSafeRoute(db, incident.id, r)
  }
  const tiles = ORDER.map((k) => evidence[k]).filter((e): e is Evidence => Boolean(e))
  const suggested = suggestedServiceKind(incident.extractedFieldsLive.dangerIndicators)

  const setTileEl = (kind: string) => (el: HTMLDivElement | null) => {
    if (el) tileEls.current.set(kind, el)
    else tileEls.current.delete(kind)
  }

  const renderContent = (e: Evidence) => {
    if (e.kind === 'stress' && incident.voiceStressScore != null) {
      return <StressWave trend={incident.voiceStressTrend} score={incident.voiceStressScore} />
    }
    if (e.kind === 'nearby' && route) {
      const step = route.steps[route.stepIndex]
      const km = route.distanceM >= 1000 ? `${(route.distanceM / 1000).toFixed(1)} km` : `${route.distanceM} m`
      return (
        <div className="route-tile">
          <div className="route-dest">
            <span className={`nearby-kind nearby-${route.destination.kind}`}>{SERVICE_LABEL[route.destination.kind]}</span>
            <span className="tile-list-main">{route.destination.name}</span>
            {route.destination.phone && <a href={`tel:${route.destination.phone}`} className="tile-call">Call</a>}
          </div>
          <div className="route-eta"><strong>{Math.max(1, Math.round(route.durationS / 60))} min</strong> · {km} · {route.requestedBy === 'responder' ? 'set by dispatcher' : 'chosen by AI'}</div>
          {step && <div className="route-next"><span className="route-next-label">Next</span><DecodeText text={step.instruction} /></div>}
        </div>
      )
    }
    if (e.kind === 'nearby' && Array.isArray(nearby) && nearby.length) {
      return (
        <ul className="tile-list">
          {nearby.slice(0, 3).map((s) => (
            <li key={`${s.kind}-${s.name}`} className={s.kind === suggested ? 'is-suggested' : undefined}>
              <span className={`nearby-kind nearby-${s.kind}`}>{SERVICE_LABEL[s.kind]}</span>
              <span className="tile-list-main">{s.name} · {s.distanceKm.toFixed(1)} km</span>
              {s.phone && <a href={`tel:${s.phone}`} className="tile-call">Call</a>}
              <button type="button" className="tile-call tile-route" onClick={() => void routeTo(s)}>Route here</button>
            </li>
          ))}
        </ul>
      )
    }
    if (e.kind === 'linked' && e.values.length) {
      return (
        <ul className="tile-list">
          {e.values.map((id) => (
            <li key={id}><Link to={`/incident/${id}`} className="mono">{id}</Link><span className="sub">same person, vehicle or place</span></li>
          ))}
        </ul>
      )
    }
    return undefined
  }

  return (
    <div className="case-board" ref={boardRef}>
      <div className="board-map">
        <IncidentMap location={incident.location} backdrop route={incident.safeRoute} />
      </div>
      <div className="board-veil" aria-hidden="true" />
      <LightLinks containerRef={boardRef} hubRef={hubRef} tileEls={tileEls} kinds={tiles.map((t) => t.kind)} accentKind="linked" />
      <div className="board-grid">
        <div className="slot-hub">
          <CaseHub severity={incident.severity} live={live} timer={timer} hubRef={hubRef} />
        </div>
        {tiles.map((e) => (
          <EvidenceTile key={e.kind} evidence={e} slot={SLOT_OF[e.kind]} elRef={setTileEl(e.kind)}>
            {renderContent(e)}
          </EvidenceTile>
        ))}
      </div>
    </div>
  )
}
