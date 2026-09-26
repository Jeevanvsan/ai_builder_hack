import { GoogleGenAI } from '@google/genai'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types'

// Web check for a live case: recent public reports of similar incidents near the place (news, police notices),
// via Gemini with Google Search grounding. Privacy rule: only the place and the incident TYPE are ever sent —
// never a name or anything that identifies the caller — so this can't become a people-search tool.
const MODEL = 'gemini-3.5-flash'
const started = new Set<string>()

export function incidentTypeOf(i: Incident): string | null {
  const t = i.extractedFieldsLive.dangerIndicators.join(' ').toLowerCase()
  if (/follow|chas/.test(t)) return 'people being followed, stalked or chased, chain snatching or robbery'
  if (/kidnap|abduct|taken/.test(t)) return 'kidnapping or abduction'
  if (/fire|smoke/.test(t)) return 'fire'
  if (/gas|chemical|leak/.test(t)) return 'gas or chemical leak'
  if (/accident|crash|road/.test(t)) return 'road accident'
  if (/child/.test(t)) return 'crimes against children'
  if (/weapon|knife|gun|attack|harm|threat|violence|fight/.test(t)) return 'violent crime, assault or robbery'
  return t ? 'crime or public-safety incidents' : null
}

export function placeOf(i: Incident): string | null {
  return i.location.confirmed?.address ?? null
}

// Runs once per incident (per dashboard session) and stores the result on the incident for every viewer.
export async function ensureWebIntel(i: Incident): Promise<void> {
  const place = placeOf(i)
  const type = incidentTypeOf(i)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!place || !type || !apiKey || i.webIntel || started.has(i.id)) return
  started.add(i.id)
  const query = `${type} near ${place}`
  try {
    const client = new GoogleGenAI({ apiKey })
    const res = await client.models.generateContent({
      model: MODEL,
      contents:
        `Search the web for PUBLIC reports from the last 60 days of ${type} in or near ${place} (news articles, police ` +
        `notices, local reports). For an emergency responder. Reply with up to 3 lines, each starting with "- ", each one ` +
        `short factual finding with its date and place. Do not include any person's name. If nothing relevant is found, ` +
        `reply with exactly "none".`,
      config: { tools: [{ googleSearch: {} }] },
    })
    const text = res.text?.trim() ?? ''
    const findings = /^none\.?$/i.test(text) ? [] : text.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 3)
    const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    const sources = chunks
      .map((c) => ({ title: c.web?.title ?? '', url: c.web?.uri ?? '' }))
      .filter((s) => s.url)
      .slice(0, 4)
    await updateDoc(doc(db, INCIDENTS, i.id), { webIntel: { query, findings, sources: findings.length ? sources : [], searchedAt: new Date().toISOString() } })
  } catch {
    started.delete(i.id) // allow a retry on the next render if the search failed
  }
}
