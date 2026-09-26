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

export function deriveEvidence(i: Incident, now: number, nearbyIds: string[] = []): Partial<Record<EvidenceKind, Evidence>> {
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

  // A "confirmed" address with no lat/lng means geocoding failed outright (see confirmAddress()) — the text is
  // still shown, but it's not treated as a located pin (no coordinates to fall back to for the ≈lat,lng display).
  const c = i.location.confirmed
  const pinned = c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null
  const loc = pinned ?? i.location.rough
  if (loc || i.location.confirmed) {
    const endedRecently = i.sessionEndedAt ? now - Date.parse(i.sessionEndedAt) < PENDING_WINDOW_MS : false
    out.location = {
      kind: 'location',
      label: 'Location',
      values: [i.location.confirmed ? i.location.confirmed.address : loc ? `≈ ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Unknown'],
      sub: i.groundedContext ?? (pinned
        ? (c?.confidence === 'uncertain' ? 'Approximate — the exact street could not be matched, area only' : undefined)
        : i.location.confirmed ? "Couldn't pin this address on the map — showing what the caller said" : 'Approximate — waiting for the caller'),
      tone: pinned ? 'live' : 'neutral',
      pending: !i.groundedContext && pinned && endedRecently ? 'Checking local conditions…' : undefined,
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
  // Linked cases = AI matches (same person/vehicle, written by the QuickBite app's correlation pass after a live call)
  // plus rule-based matches computed here: any other incident within 300 m in the last 7 days. The rule part needs
  // no AI and works for every channel, so a repeat location is never missed. The shimmer only shows while the AI
  // pass can genuinely still be running (a live call that just ended).
  const ids = [...new Set([...(i.correlatedIncidentIds ?? []), ...nearbyIds])]
  const aiPending = i.channel === 'live-call' && endedRecently && !i.correlatedIncidentIds
  if (ids.length) {
    out.linked = { kind: 'linked', label: 'Linked cases', values: ids, tone: 'live', pending: aiPending ? 'AI cross-checking person & vehicle…' : undefined }
  } else if (aiPending) {
    out.linked = { kind: 'linked', label: 'Linked cases', values: [], tone: 'neutral', pending: 'AI cross-checking person & vehicle…' }
  }

  return out
}

const NEAR_M = 300
const WINDOW_MS = 7 * 24 * 3600_000

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(h))
}

// Other incidents reported at (almost) the same place recently — closest and newest first, capped at 5.
const asPin = (l: Incident['location']): { lat: number; lng: number } | null => {
  const c = l.confirmed
  return c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : l.rough
}

export function nearbyIncidentIds(i: Incident, all: Incident[]): string[] {
  const here = asPin(i.location)
  if (!here) return []
  const t = Date.parse(i.sessionStartedAt)
  return all
    .filter((o) => o.id !== i.id && Math.abs(Date.parse(o.sessionStartedAt) - t) < WINDOW_MS)
    .map((o) => ({ o, loc: asPin(o.location) }))
    .filter((x): x is { o: Incident; loc: NonNullable<typeof x.loc> } => Boolean(x.loc) && metres(here, x.loc!) < NEAR_M)
    .sort((a, b) => Date.parse(b.o.sessionStartedAt) - Date.parse(a.o.sessionStartedAt))
    .slice(0, 5)
    .map((x) => x.o.id)
}
