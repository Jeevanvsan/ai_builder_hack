import { arrayUnion, doc, getDoc, runTransaction, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { geocodeAddress } from './geocode.ts'
import { gpsLocation, ipLocation } from './location.ts'
import { deriveSeverity, maxSeverity } from './severity.ts'
import type { Channel, Incident, RoughLocation } from './types.ts'

// Write side of the incident pipeline (Epic 3), called by the QuickBite app. The dashboard only reads.

export const INCIDENTS = 'incidents'

const GPS_WAIT_MS = 5_000
const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms))
const ref = (db: Firestore, id: string) => doc(db, INCIDENTS, id)

export const newIncidentId = () => `INC-${Date.now().toString(36).toUpperCase()}`

type LiveFields = Incident['extractedFieldsLive']

// Creates the incident the instant a session starts, so the dashboard alerts before any location or fields exist.
// The returned `located` promise settles once a rough location has been attached (or couldn't be found).
export async function startIncident(
  db: Firestore,
  opts: { channel: Channel; id?: string },
): Promise<{ id: string; located: Promise<RoughLocation | null> }> {
  const id = opts.id ?? newIncidentId()
  const startedAt = now()
  const initial: Omit<Incident, 'id'> = {
    sessionStartedAt: startedAt,
    sessionEndedAt: null,
    channel: opts.channel,
    callState: 'active',
    location: { rough: null, confirmed: null },
    extractedFieldsLive: { peopleCount: null, dangerIndicators: [], urgency: null, notes: null },
    consolidatedSummary: null,
    fieldConfidence: {},
    voiceStressScore: null,
    voiceStressTrend: [],
    leakageCheckStatus: { reviewed: false, redactions: [] },
    severity: 'low',
    response: { status: 'new', acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, notes: [], viewedAt: null, viewedBy: null },
  }
  await setDoc(ref(db, id), initial)
  return { id, located: attachRoughLocation(db, id) }
}

// GPS if it answers quickly; otherwise IP fallback now, upgraded to GPS if it arrives later (e.g. permission granted late).
async function attachRoughLocation(db: Firestore, id: string): Promise<RoughLocation | null> {
  const write = (rough: RoughLocation) => updateDoc(ref(db, id), { 'location.rough': rough })
  const gps = gpsLocation()
  const quick = await Promise.race([gps, sleep(GPS_WAIT_MS)])
  if (quick) {
    await write(quick)
    return quick
  }
  const ip = await ipLocation()
  if (ip) await write(ip)
  void gps.then((late) => late && write(late))
  return ip
}

// Merges partial extraction results mid-call. Severity is recomputed here and never drops during a live call,
// so a responder never sees an incident quietly de-escalate while it's still unfolding.
export function updateLiveFields(db: Firestore, id: string, patch: Partial<LiveFields>): Promise<void> {
  return runTransaction(db, async (tx) => {
    const current = (await tx.get(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
    if (!current) throw new Error(`Incident ${id} not found`)
    const merged = { ...current.extractedFieldsLive, ...patch }
    const update: Record<string, unknown> = {
      severity: maxSeverity(current.severity, deriveSeverity(merged, current.voiceStressScore)),
    }
    for (const [key, value] of Object.entries(patch)) update[`extractedFieldsLive.${key}`] = value
    tx.update(ref(db, id), update)
  })
}

export function recordVoiceStress(db: Firestore, id: string, score: number): Promise<void> {
  return runTransaction(db, async (tx) => {
    const current = (await tx.get(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
    if (!current) throw new Error(`Incident ${id} not found`)
    tx.update(ref(db, id), {
      voiceStressScore: score,
      voiceStressTrend: arrayUnion({ timestamp: now(), score }),
      severity: maxSeverity(current.severity, deriveSeverity(current.extractedFieldsLive, score)),
    })
  })
}

// Turns the caller's spoken "delivery address" into a pinned location. If geocoding fails, the spoken address is
// still stored (it's what a responder most needs) against the rough coordinates, marked uncertain.
export async function confirmAddress(
  db: Firestore,
  id: string,
  spokenAddress: string,
  opts: { googleMapsKey?: string } = {},
): Promise<Incident['location']['confirmed']> {
  const current = (await getDoc(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
  const rough = current?.location.rough ?? null
  const hit = await geocodeAddress(spokenAddress, { near: rough, googleMapsKey: opts.googleMapsKey })
  const coords = hit ?? rough
  if (!coords) return null
  const confirmed = {
    address: spokenAddress,
    lat: coords.lat,
    lng: coords.lng,
    confidence: hit ? ('confirmed' as const) : ('uncertain' as const),
    confirmedAt: now(),
  }
  await updateDoc(ref(db, id), { 'location.confirmed': confirmed })
  return confirmed
}

export function endIncident(db: Firestore, id: string): Promise<void> {
  return updateDoc(ref(db, id), { callState: 'ended', sessionEndedAt: now() })
}
