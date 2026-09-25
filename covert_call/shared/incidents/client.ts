import { arrayUnion, doc, getDoc, runTransaction, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { geocodeAddress } from './geocode.ts'
import { gpsLocation, ipLocation } from './location.ts'
import { deriveSeverity, maxSeverity } from './severity.ts'
import type { Channel, FieldConfidence, Incident, RoughLocation } from './types.ts'

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
//
// peopleCount/urgency are "current known value" fields — a fresh call overwrites the old one, which is correct
// (the latest read is the best one). dangerIndicators and notes are cumulative signals from a whole conversation
// and must NEVER be overwritten field-by-field like that: a caller who reports "weapon present" early and then
// "aggressor present" later needs both remembered, not just the last one. dangerIndicators is deduped and
// appended; notes (a single string, not an array, per the incident schema) has new distinct text appended.
export function updateLiveFields(db: Firestore, id: string, patch: Partial<LiveFields>): Promise<void> {
  return runTransaction(db, async (tx) => {
    const current = (await tx.get(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
    if (!current) throw new Error(`Incident ${id} not found`)
    const existing = current.extractedFieldsLive

    const mergedPatch: Partial<LiveFields> = { ...patch }
    if (patch.dangerIndicators) {
      mergedPatch.dangerIndicators = [...new Set([...existing.dangerIndicators, ...patch.dangerIndicators])]
    }
    if (typeof patch.notes === 'string' && patch.notes.trim()) {
      const newNote = patch.notes.trim()
      mergedPatch.notes = existing.notes && !existing.notes.includes(newNote) ? `${existing.notes} | ${newNote}` : (existing.notes ?? newNote)
    }

    const merged = { ...existing, ...mergedPatch }
    const update: Record<string, unknown> = {
      severity: maxSeverity(current.severity, deriveSeverity(merged, current.voiceStressScore)),
    }
    for (const [key, value] of Object.entries(mergedPatch)) update[`extractedFieldsLive.${key}`] = value
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

// Flags that the full call recording was saved to the incidents/{id}/recording/audio subcollection doc — the
// save itself happens in the caller (web/src/lib/gemini/uploadRecording.ts), this just flags the result.
export function markHasRecording(db: Firestore, id: string): Promise<void> {
  return updateDoc(ref(db, id), { hasRecording: true })
}

// A scene observation whose wording signals immediate danger is also promoted to a danger indicator so it lifts
// severity through the normal path — a gunshot the AI hears must escalate the incident, not just get logged.
const DANGEROUS_OBSERVATION = /weapon|gun|firearm|knife|gunshot|shot|scream|explosion|blast|fire|smoke|stab|blood|fight|attack|assault|chok|strangl/i

// Records something the AI saw on the camera or heard in the background (Epic 10). Appends to sceneObservations
// and, if it reads as dangerous, also adds a danger indicator and re-derives severity in the same transaction.
export function reportSceneObservation(
  db: Firestore,
  id: string,
  obs: { source: 'camera' | 'sound'; kind: string; detail?: string; confidence?: number },
): Promise<void> {
  return runTransaction(db, async (tx) => {
    const current = (await tx.get(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
    if (!current) throw new Error(`Incident ${id} not found`)
    const detail = obs.detail?.trim() ?? ''
    const entry = { source: obs.source, kind: obs.kind, detail, confidence: obs.confidence ?? null, at: now() }
    const update: Record<string, unknown> = {
      sceneObservations: [...(current.sceneObservations ?? []), entry],
    }
    if (DANGEROUS_OBSERVATION.test(`${obs.kind} ${detail}`)) {
      const indicator = detail ? `${obs.kind}: ${detail}` : obs.kind
      const di = [...new Set([...current.extractedFieldsLive.dangerIndicators, indicator])]
      update['extractedFieldsLive.dangerIndicators'] = di
      const merged = { ...current.extractedFieldsLive, dangerIndicators: di }
      update.severity = maxSeverity(current.severity, deriveSeverity(merged, current.voiceStressScore))
    }
    tx.update(ref(db, id), update)
  })
}

// Records a piece of safety advice the persona gave the caller (Epic 10.4).
export function recordAdvice(db: Firestore, id: string, text: string): Promise<void> {
  return updateDoc(ref(db, id), { adviceGiven: arrayUnion({ text: text.trim(), at: now() }) })
}

type VideoRecording = NonNullable<Incident['videoRecording']>[number]

// Upserts one camera's Drive-recording entry by camera name (Epic 9.2 / 11). Transactional so the back and
// front cameras of a silent SOS, which finish at slightly different times, never clobber each other's entry.
// A partial patch (e.g. just status + driveUrl at upload time) merges onto the existing entry; a first write for
// a camera fills sensible defaults.
export function upsertVideoRecording(
  db: Firestore,
  id: string,
  entry: { camera: 'back' | 'front' } & Partial<Omit<VideoRecording, 'camera'>>,
): Promise<void> {
  return runTransaction(db, async (tx) => {
    const current = (await tx.get(ref(db, id))).data() as Omit<Incident, 'id'> | undefined
    if (!current) throw new Error(`Incident ${id} not found`)
    const list = [...(current.videoRecording ?? [])]
    const i = list.findIndex((r) => r.camera === entry.camera)
    if (i >= 0) list[i] = { ...list[i], ...entry }
    else list.push({ status: 'recording', startedAt: now(), ...entry })
    tx.update(ref(db, id), { videoRecording: list })
  })
}

// A second Gemini pass reviews the call for uninvolved third parties mentioned without consent (a bystander, a
// child) — this just records the result; the review itself happens in the caller (Epic 2.2).
export function recordLeakageCheck(db: Firestore, id: string, redactions: string[]): Promise<void> {
  return updateDoc(ref(db, id), { leakageCheckStatus: { reviewed: true, redactions } })
}

// Replaces the live working state with a permanent, dispatcher-style case record once the call has ended.
// Call after endIncident() (or endIncident() can follow this — order doesn't matter, they touch different fields).
export function consolidateIncident(
  db: Firestore,
  id: string,
  patch: { consolidatedSummary: string; fieldConfidence: Record<string, FieldConfidence> },
): Promise<void> {
  return updateDoc(ref(db, id), { consolidatedSummary: patch.consolidatedSummary, fieldConfidence: patch.fieldConfidence })
}
