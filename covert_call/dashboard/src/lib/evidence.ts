import type { Incident } from '../../../shared/incidents/types'

// Sorts what an incident already knows into the case board's evidence tiles. Pure: no new data, no fetching.
// Each tile has a fixed slot around the hub, so tiles never jump around as facts arrive, and a tile only exists
// when there is real data (or a genuinely-running AI step) behind it.
export type EvidenceKind = 'vehicle' | 'location' | 'subjects' | 'threat' | 'stress' | 'seen' | 'nearby' | 'linked'
export type Tone = 'high' | 'medium' | 'low' | 'live' | 'neutral'

export type Evidence = {
  kind: EvidenceKind
  label: string
  values: string[]
  sub?: string
  tone: Tone
  // Set while an AI step for this tile is still running — the tile shows a searching shimmer with this label.
  pending?: string
}

// Clockwise from top-left, skipping the centre cell (the hub).
export const SLOT_OF: Record<EvidenceKind, string> = {
  vehicle: 'tl',
  location: 'tc',
  subjects: 'tr',
  threat: 'ml',
  stress: 'mr',
  seen: 'bl',
  nearby: 'bc',
  linked: 'br',
}

const VEHICLE = /\b(car|vehicle|bike|motorbike|scooter|van|truck|auto|jeep|lorry)\b/i
const APPEARANCE = /(wearing|cloth|build|tall|short|older|young|slim|beard|hair)/i
const PEOPLE = /\b\d+\+?\s*(people|persons?)\b/i
const WEAPON = /(weapon|knife|gun|firearm|blade|rod)/i

// A pending AI step is only shown for a short window after the call ends — if nothing arrives by then, the step
// found nothing (or didn't run), and the tile disappears instead of claiming to still be searching.
const PENDING_WINDOW_MS = 60_000

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function deriveEvidence(i: Incident, now: number): Partial<Record<EvidenceKind, Evidence>> {
  const out: Partial<Record<EvidenceKind, Evidence>> = {}
  const f = i.extractedFieldsLive

  const vehicle: string[] = []
  const appearance: string[] = []
  const people: string[] = []
  const threat: string[] = []
  for (const d of f.dangerIndicators) {
    if (PEOPLE.test(d)) people.push(d)
    else if (VEHICLE.test(d)) vehicle.push(d)
    else if (APPEARANCE.test(d)) appearance.push(d)
    else threat.push(d)
  }

  if (vehicle.length) out.vehicle = { kind: 'vehicle', label: 'Vehicle', values: vehicle.map(cap), tone: 'medium' }

  const loc = i.location.confirmed ?? i.location.rough
  if (loc) {
    const endedRecently = i.sessionEndedAt ? now - Date.parse(i.sessionEndedAt) < PENDING_WINDOW_MS : false
    out.location = {
      kind: 'location',
      label: 'Location',
      values: [i.location.confirmed ? i.location.confirmed.address : `≈ ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`],
      sub: i.groundedContext ?? (i.location.confirmed ? undefined : 'Approximate — waiting for the caller'),
      tone: i.location.confirmed ? 'live' : 'neutral',
      pending: !i.groundedContext && i.location.confirmed && endedRecently ? 'Checking local conditions…' : undefined,
    }
  }

  const count = f.peopleCount != null ? `${f.peopleCount} ${f.peopleCount === 1 ? 'person' : 'people'}` : people[0]
  if (count || appearance.length) {
    out.subjects = { kind: 'subjects', label: 'Subjects', values: [...(count ? [cap(count)] : []), ...appearance.map(cap)], tone: 'medium' }
  }

  if (threat.length || f.urgency) {
    const weaponFirst = [...threat].sort((a, b) => Number(WEAPON.test(b)) - Number(WEAPON.test(a)))
    out.threat = {
      kind: 'threat',
      label: 'Threat',
      values: weaponFirst.map(cap),
      sub: f.urgency ? `Urgency: ${f.urgency}` : undefined,
      tone: threat.some((d) => WEAPON.test(d)) || f.urgency === 'high' ? 'high' : 'medium',
    }
  }

  if (i.voiceStressScore != null) {
    const s = i.voiceStressScore
    out.stress = { kind: 'stress', label: 'Voice stress', values: [String(s)], tone: s >= 70 ? 'high' : s >= 45 ? 'medium' : 'low' }
  }

  const obs = i.sceneObservations ?? []
  if (obs.length) {
    out.seen = {
      kind: 'seen',
      label: 'Seen & heard',
      values: obs.slice(-3).map((o) => `${o.source === 'sound' ? 'Heard' : 'Seen'}: ${o.kind}${o.detail ? ` — ${o.detail}` : ''}`),
      sub: obs.length > 3 ? `+${obs.length - 3} earlier` : undefined,
      tone: 'high',
    }
  }

  const endedRecently = i.sessionEndedAt ? now - Date.parse(i.sessionEndedAt) < PENDING_WINDOW_MS : false
  if (i.correlatedIncidentIds?.length) {
    out.linked = { kind: 'linked', label: 'Linked cases', values: i.correlatedIncidentIds, tone: 'live' }
  } else if (endedRecently && !i.correlatedIncidentIds) {
    out.linked = { kind: 'linked', label: 'Linked cases', values: [], tone: 'neutral', pending: 'Cross-checking recent cases…' }
  }

  return out
}
