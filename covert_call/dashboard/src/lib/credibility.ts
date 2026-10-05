import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types.ts'
import { db } from './firebase'

// Epic 31: the verification agent. After a call ends, Gemini weighs whether it may be a false or prank call and
// says why, from signals we already have: does the story hold together, does the stated address match GPS, does
// the voice match the words, what the camera and microphone picked up, and this phone's history. It is ADVISORY:
// it only helps a responder prioritise and never closes, hides or downgrades a case. Missing a real emergency is
// far worse than answering a prank.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-3.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
export const credibilityAvailable = Boolean(API_KEY)

export type Credibility = NonNullable<Incident['credibility']>

export type CallerHistory = {
  phone: string | null // only responders can read this (callers/{uid})
  verified: boolean
  previousCalls: number
  callsLast24h: number
  markedFalse: number // earlier calls a responder marked false alarm or prank
  markedGenuine: number
}

export async function loadCallerHistory(incident: Incident): Promise<CallerHistory | null> {
  if (!incident.callerUid) return null
  const [profile, snap] = await Promise.all([
    getDoc(doc(db, 'callers', incident.callerUid)).catch(() => null),
    getDocs(query(collection(db, INCIDENTS), where('callerUid', '==', incident.callerUid))).catch(() => null),
  ])
  const others = (snap?.docs ?? []).filter((d) => d.id !== incident.id).map((d) => d.data() as Omit<Incident, 'id'>)
  const dayAgo = Date.parse(incident.sessionStartedAt) - 24 * 3600_000
  const phone = (profile?.data()?.phone as string | undefined) ?? null
  const markedFalse = others.filter((o) => o.response.outcome === 'false-alarm' || o.response.outcome === 'prank').length
  // Backfill: devices marked false before flaggedDevices existed get their entry, so their alerts go quiet too.
  if (markedFalse) void setDoc(doc(db, 'flaggedDevices', incident.callerUid), { falseCount: markedFalse, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {})
  return {
    phone,
    verified: Boolean(phone),
    previousCalls: others.length,
    callsLast24h: others.filter((o) => Date.parse(o.sessionStartedAt) >= dayAgo).length,
    markedFalse,
    markedGenuine: others.filter((o) => o.response.outcome === 'genuine').length,
  }
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// Everything the agent sees, as compact facts (no names or numbers: the phone number is never sent to the model).
function evidence(i: Incident, h: CallerHistory | null): string {
  const f = i.extractedFieldsLive
  const rough = i.location.rough
  const conf = i.location.confirmed
  const gap = rough && conf?.lat != null && conf.lng != null ? km(rough, { lat: conf.lat, lng: conf.lng }) : null
  const minutes = i.sessionEndedAt ? (Date.parse(i.sessionEndedAt) - Date.parse(i.sessionStartedAt)) / 60000 : null
  const lines = (i.transcriptLines ?? []).slice(-40).map((l) => `${l.speaker}: ${l.text}`).join('\n')
  return [
    `channel=${i.channel}${i.incidentType === 'sos' ? ' (silent SOS)' : ''}; call_minutes=${minutes?.toFixed(1) ?? 'unknown'}`,
    `danger_tags=${f.dangerIndicators.join(' | ') || 'none'}; urgency=${f.urgency ?? 'none'}; people=${f.peopleCount ?? 'unknown'}`,
    `voice_stress_trend=${(i.voiceStressTrend ?? []).map((v) => v.score).join(',') || 'none'}`,
    `stated_address=${conf?.address ?? 'none'}; gps_source=${rough?.source ?? "unknown"}; distance_gps_to_stated_address_km=${gap?.toFixed(1) ?? 'unknown'}`,
    `camera_and_sound=${(i.sceneObservations ?? []).map((o) => `${o.source}:${o.detail}`).join(' | ') || 'none'}`,
    `coercion_signals=${(i.coercionSignals ?? []).map((c) => c.detail || c.kind).join(' | ') || 'none'}`,
    `motion=${(i.motionEvents ?? []).map((m) => m.kind).join(',') || 'none'}`,
    h ? `device: phone_verified=${h.verified}; earlier_calls=${h.previousCalls}; calls_last_24h=${h.callsLast24h}; earlier_marked_false=${h.markedFalse}; earlier_marked_genuine=${h.markedGenuine}`
      : 'device: no caller id (older app version)',
    `transcript (may be partial):\n${lines || '(none)'}`,
  ].join('\n')
}

const PROMPT = `You review emergency calls for a responder team. The caller app is disguised as a food-delivery app:
in a covert call the caller orders food and coded food words mean danger, so short answers, food talk, whispering
and a quiet or abrupt end are NORMAL and must not count against the call. A forced "cancel" or a second voice
taking over is a sign of coercion, which means MORE danger, never a prank.
Estimate how likely this call is GENUINE (0 = almost certainly false or a prank, 100 = clearly genuine), from:
story consistency, the stated address vs GPS (a big gap can also just mean the caller is moving or reporting for
someone else), voice stress vs the words, what the camera and microphone picked up (laughter, chatter, a calm scene
while claiming an attack), and the device's history (many recent calls, earlier calls marked false).
When the evidence is thin, say so: score 50-70 and level "uncertain". Only use "possible-false" with clear signs.
Give up to 4 short reasons a responder can check, each naming the signal, e.g. "Laughter heard at 0:42".`

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    level: { type: 'string', enum: ['likely-genuine', 'uncertain', 'possible-false'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['score', 'level', 'reasons'],
}

export async function assessCredibility(incident: Incident, history: CallerHistory | null): Promise<Credibility> {
  if (!API_KEY) throw new Error('Gemini is not configured')
  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${PROMPT}\n\nCALL EVIDENCE:\n${evidence(incident, history)}` }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`)
  const data = await res.json()
  const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as Partial<Credibility>
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 60))))
  const level = parsed.level && ['likely-genuine', 'uncertain', 'possible-false'].includes(parsed.level) ? parsed.level : 'uncertain'
  return { score, level, reasons: (parsed.reasons ?? []).slice(0, 4).map((r) => String(r).slice(0, 160)), at: new Date().toISOString() }
}

export const saveCredibility = (id: string, c: Credibility) => updateDoc(doc(db, INCIDENTS, id), { credibility: c })
// Saves the responder's finding, then recounts this device's false/prank calls into flaggedDevices/{uid}, which
// the alert system reads to keep later calls from that device quiet (no siren) and labelled.
export async function saveOutcome(incident: Incident, outcome: Incident['response']['outcome']): Promise<void> {
  await updateDoc(doc(db, INCIDENTS, incident.id), { 'response.outcome': outcome ?? null })
  if (!incident.callerUid) return
  const snap = await getDocs(query(collection(db, INCIDENTS), where('callerUid', '==', incident.callerUid)))
  const falseCount = snap.docs.filter((d) => ['false-alarm', 'prank'].includes(d.data().response?.outcome)).length
  await setDoc(doc(db, 'flaggedDevices', incident.callerUid), falseCount
    ? { falseCount, updatedAt: new Date().toISOString() }
    : { falseCount: 0, updatedAt: new Date().toISOString(), cleared: true }, { merge: true })
}

// Live set of device ids a responder has marked false at least once (for quiet, labelled alerts).
export function watchFlaggedDevices(onChange: (flagged: Map<string, number>) => void): () => void {
  return onSnapshot(query(collection(db, 'flaggedDevices'), where('falseCount', '>', 0)),
    (snap) => onChange(new Map(snap.docs.map((d) => [d.id, Number(d.data().falseCount) || 0]))),
    () => onChange(new Map()))
}
