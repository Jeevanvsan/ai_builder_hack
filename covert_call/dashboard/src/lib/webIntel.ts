import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types'

// Web check for a live case: recent public NEWS near the place, for this kind of incident, via Google News' free
// RSS search (no API key, no billing — unlike Gemini's Search-grounding tool, which the free tier gates behind
// billing being enabled). Privacy rule: only the place and the incident TYPE are ever sent — never a name or
// anything that identifies the caller — so this can't become a people-search tool.
const started = new Set<string>()

export function incidentTypeOf(i: Incident): string | null {
  const t = i.extractedFieldsLive.dangerIndicators.join(' ').toLowerCase()
  if (/follow|chas/.test(t)) return 'chain snatching OR stalking OR chasing OR robbery'
  if (/kidnap|abduct|taken/.test(t)) return 'kidnapping OR abduction'
  if (/fire|smoke/.test(t)) return 'fire'
  if (/gas|chemical|leak/.test(t)) return 'gas leak OR chemical leak'
  if (/accident|crash|road/.test(t)) return 'road accident'
  if (/child/.test(t)) return 'crime against children'
  if (/weapon|knife|gun|attack|harm|threat|violence|fight/.test(t)) return 'assault OR robbery OR violence'
  return t ? 'crime OR public safety incident' : null
}

export function placeOf(i: Incident): string | null {
  return i.location.confirmed?.address ?? null
}

// A confirmed address is often "Road, Area, Town - PIN"; News search does best with just the town/area, not the
// full string with a PIN code and building-level detail.
function placeForSearch(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.slice(-2).join(', ').replace(/-?\s*\d{6}\s*$/, '').trim() || address
}

type Item = { title: string; url: string; date: string }

async function searchNews(query: string): Promise<Item[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`
  const res = await fetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5).map((m) => ({
    title: decode(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    url: m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '',
    date: m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '',
  })).filter((it) => it.title && it.url)
}

// Runs once per incident (per dashboard session) and stores the result on the incident for every viewer.
export async function ensureWebIntel(i: Incident): Promise<void> {
  const place = placeOf(i)
  const type = incidentTypeOf(i)
  if (!place || !type || i.webIntel || started.has(i.id)) return
  started.add(i.id)
  const searchPlace = placeForSearch(place)
  const query = `(${type}) "${searchPlace}"`
  try {
    let items = await searchNews(query)
    // Fall back to a looser query (drop the exact-phrase place match) if nothing came back.
    if (!items.length) items = await searchNews(`(${type}) ${searchPlace}`)
    const findings = items.slice(0, 3).map((it) => `${it.title}${it.date ? ` (${new Date(it.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}`)
    const sources = items.slice(0, 3).map((it) => ({ title: it.title, url: it.url }))
    await updateDoc(doc(db, INCIDENTS, i.id), { webIntel: { query: `${type} near ${searchPlace}`, findings, sources: findings.length ? sources : [], searchedAt: new Date().toISOString() } })
  } catch {
    started.delete(i.id) // allow a retry on the next render if the search failed
  }
}
