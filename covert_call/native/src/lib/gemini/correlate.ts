import { AI_MODELS } from '../../../../shared/aiModels'
import { geminiKeys, generateWithFallback } from './keys'
import { collection, getDocs, limit, orderBy, query, type Firestore } from 'firebase/firestore'
import { GoogleGenAI } from '@google/genai'
import { INCIDENTS } from '../../../../shared/incidents/client'
import type { Incident } from '../../../../shared/incidents/types'

// Native port of web/src/lib/gemini/correlate.ts — keep in sync.
//
// Checks whether this incident's confirmed address, any vehicle description, or any name mentioned matches
// another open or recent incident already in Firestore. Stays entirely inside data we already legitimately hold
// — no external lookups, no identity resolution.
const MODEL = AI_MODELS.caseLinking // shared/aiModels.ts
const RECENT_LIMIT = 25

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { matchIds: { type: 'array', items: { type: 'string' } } },
  required: ['matchIds'],
}

function summarize(incident: Incident): string {
  const addr = incident.location.confirmed?.address ?? '-'
  const vehicle =
    incident.extractedFieldsLive.dangerIndicators.find((d) => /vehicle|car|scooter|bike|motorbike|colour|color/i.test(d)) ?? '-'
  const notes = incident.extractedFieldsLive.notes ?? '-'
  return `${incident.id}: address="${addr}" vehicle="${vehicle}" notes="${notes.slice(0, 200)}"`
}

export async function findCorrelatedIncidents(db: Firestore, incident: Incident): Promise<string[]> {
  if (!geminiKeys.configured) return []

  const hasSomethingToMatch = incident.location.confirmed?.address || incident.extractedFieldsLive.notes
  if (!hasSomethingToMatch) return []

  const q = query(collection(db, INCIDENTS), orderBy('sessionStartedAt', 'desc'), limit(RECENT_LIMIT))
  const snap = await getDocs(q)
  const others = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) }))
    .filter((i) => i.id !== incident.id)
  if (!others.length) return []
  const prompt = `Emergency dispatch cross-reference check. Does the NEW incident below appear to describe the
same person, vehicle, or location as any of the OTHER recent incidents? Only flag a genuine match (same specific
address, same distinctive vehicle description, same clearly-matching detail) — do not flag on vague similarity
alone (e.g. both mentioning "a car" isn't enough).

NEW incident: ${summarize(incident)}

OTHER incidents:
${others.map(summarize).join('\n')}

Return matchIds: the incident IDs from OTHER that appear to genuinely match, or an empty list if none do.`

  try {
    const response = await generateWithFallback({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    })
    const text = response.text
    if (!text) return []
    const parsed = JSON.parse(text) as { matchIds?: string[] }
    const validIds = new Set(others.map((o) => o.id))
    return (parsed.matchIds ?? []).filter((id) => validIds.has(id))
  } catch {
    return [] // Best-effort — never blocks consolidation.
  }
}
