import { AI_MODELS } from '../../../shared/aiModels.ts'
import { geminiFetch, geminiKeys } from './geminiKeys'
import type { Incident } from '../../../shared/incidents/types'
import { channelLabel } from './format'

// Natural-language incident search for the live queue and case history. Two layers:
// 1. Local, instant, free: every word of the query (minus filler) is matched against everything known about a case
//    — summary, danger tags, what was seen/heard, transcript, bulletin, address — with a small synonym table so
//    "woman hit with a hammer" finds a case tagged "weapon: hammer" and "female voice in distress".
// 2. AI (on Enter / "Ask AI"): Gemini reads a short digest of each case and returns the ones that match the
//    described situation, with a one-line reason each. Falls back to the local result if it fails (quota etc).

const MODEL = AI_MODELS.smartSearch // shared/aiModels.ts
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
export const aiSearchAvailable = geminiKeys.configured

const STOPWORDS = new Set(
  'a an the of in on at to for with and or is are was were be been being someone somebody person people case cases incident incidents call calls where who which that this those these there their them they it its from by near about any all show find me my i we our some has have had being what when how into over just like'.split(' '),
)

// Each group is interchangeable for matching. Kept small and situational — the AI mode handles the long tail.
const SYNONYMS: string[][] = [
  ['woman', 'female', 'girl', 'lady', 'she', 'her', 'mother', 'wife'],
  ['man', 'male', 'boy', 'guy', 'he', 'him', 'husband', 'father'],
  ['child', 'kid', 'kids', 'children', 'baby', 'minor', 'teen'],
  ['weapon', 'knife', 'gun', 'hammer', 'blade', 'rod', 'stick', 'armed', 'pistol'],
  ['hit', 'beaten', 'beating', 'hitting', 'assault', 'attacked', 'attack', 'violence', 'violent', 'hurt', 'punch'],
  ['crying', 'cry', 'screaming', 'scream', 'distress', 'distressed', 'shouting', 'yelling', 'pleading'],
  ['injured', 'injury', 'bleeding', 'blood', 'wounded', 'hurt'],
  ['kidnap', 'kidnapped', 'abduct', 'abducted', 'hostage', 'held', 'captive', 'locked', 'trapped'],
  ['follow', 'followed', 'following', 'chased', 'chasing', 'stalked', 'stalking'],
  ['car', 'vehicle', 'bike', 'van', 'auto', 'truck', 'driving'],
  ['fire', 'smoke', 'burning'],
  ['sos', 'silent-sos'],
  ['call', 'voice', 'live-call'],
]
const SYN_INDEX = new Map<string, string[]>()
for (const group of SYNONYMS) for (const w of group) SYN_INDEX.set(w, [...(SYN_INDEX.get(w) ?? []), ...group])

function terms(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

// Everything a responder might describe a case by, as one lowercase string.
export function incidentText(i: Incident): string {
  const b = i.bulletin
  return [
    i.id,
    i.channel,
    channelLabel(i.channel),
    i.incidentType,
    i.scenario,
    i.severity,
    i.location.confirmed?.address,
    i.response.acknowledgedBy,
    i.consolidatedSummary,
    i.extractedFieldsLive.notes,
    ...i.extractedFieldsLive.dangerIndicators,
    ...(i.sceneObservations ?? []).map((o) => `${o.kind} ${o.detail}`),
    ...(i.transcriptLines ?? []).map((l) => l.text),
    b && `${b.subjects} ${b.weapons} ${b.vehicle} ${b.status}`,
    i.callerEstimate && `${i.callerEstimate.ageGroup} ${i.callerEstimate.gender}`,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

// Local score: how many query terms (or a synonym) appear. A case must hit at least half of them, so a long
// sentence doesn't need every word to match. Returns ids ordered best-first.
export function localSearch(incidents: Incident[], q: string): Incident[] {
  const ts = terms(q)
  if (!ts.length) return incidents
  const need = Math.max(1, Math.ceil(ts.length / 2))
  return incidents
    .map((i) => {
      const text = incidentText(i)
      const score = ts.filter((t) => (SYN_INDEX.get(t) ?? [t]).some((w) => text.includes(w))).length
      return { i, score }
    })
    .filter((r) => r.score >= need)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.i)
}

export type AiMatch = { id: string; reason: string }

function digest(i: Incident): string {
  const parts = [
    `${i.id} [${i.severity}, ${i.channel}${i.scenario ? `/${i.scenario}` : ''}, ${i.sessionStartedAt.slice(0, 10)}]`,
    i.location.confirmed?.address && `at ${i.location.confirmed.address}`,
    i.consolidatedSummary,
    i.extractedFieldsLive.dangerIndicators.length && `danger: ${i.extractedFieldsLive.dangerIndicators.join(', ')}`,
    i.extractedFieldsLive.peopleCount != null && `people: ${i.extractedFieldsLive.peopleCount}`,
    (i.sceneObservations ?? []).slice(0, 4).map((o) => o.detail || o.kind).join('; '),
    !i.consolidatedSummary && (i.transcriptLines ?? []).slice(0, 6).map((l) => l.text).join(' '),
  ]
  return parts.filter(Boolean).join(' | ').slice(0, 250)
}

export async function aiSearch(incidents: Incident[], q: string): Promise<AiMatch[]> {
  if (!geminiKeys.configured) throw new Error('Gemini API key not configured')
  // Newest first, capped so the request stays small on the free tier.
  const pool = [...incidents].sort((a, b) => Date.parse(b.sessionStartedAt) - Date.parse(a.sessionStartedAt)).slice(0, 60)
  const prompt =
    `You search emergency incident records for a responder. Query: "${q}"\n` +
    `Return the records that match the described situation (meaning, not just words: "woman attacked with a ` +
    `weapon" matches a female caller and a hammer). Best match first, at most 20. Reason: one short phrase on ` +
    `why it matches. Return an empty list if nothing fits — don't pad.\n\nRecords:\n` +
    pool.map(digest).join('\n')

  const res = await geminiFetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] },
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`AI search failed (${res.status})`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('AI search returned nothing')
  const known = new Set(pool.map((i) => i.id))
  return (JSON.parse(text) as AiMatch[]).filter((m) => known.has(m.id))
}
