export type Coordinates = { lat: number; lng: number }

async function viaGoogle(address: string, key: string): Promise<Coordinates | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const data = await (await fetch(url)).json()
  const loc = data.status === 'OK' ? data.results?.[0]?.geometry?.location : null
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

// Nominatim's place_rank is coarser the bigger the area: countries/states are ~4-8, districts ~10-12, a
// town/city/village lands at 14+, a street or POI higher still. A district-or-larger "hit" is a real place, but
// its lat/lng is the CENTROID OF ITS WHOLE BOUNDING BOX — for a district the size of Alappuzha (45km x 65km) that
// centroid can be a rural point tens of km from the caller, from the town itself, from anything they mentioned.
// Confirmed in testing: bare "Alappuzha" resolves to the district boundary (place_rank 10), landing nowhere near
// the actual town. Never trust a hit this coarse as a pin — it looks like a normal, confident result but isn't
// one at the precision an emergency pin needs.
const MIN_USABLE_PLACE_RANK = 14

// Nominatim's usage policy is ~1 request/second per client, and one address can try ~10 queries (variants,
// pincode, town). Those used to go out in a burst and got this client 429-blocked, so every address failed.
// Now: requests are spaced out, results are cached, and while Nominatim is refusing us the queries go to Photon
// (komoot's free OpenStreetMap geocoder, no key) instead.
const NOMINATIM_GAP_MS = 1100
const BLOCKED_FOR_MS = 120_000
let nextNominatimAt = 0
let nominatimBlockedUntil = 0
const searchCache = new Map<string, Promise<Coordinates | null>>()

function nominatimSearch(query: string, near: Coordinates | null): Promise<Coordinates | null> {
  const key = `${query}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`
  if (!searchCache.has(key)) {
    const p = osmSearch(query, near)
    // Don't cache a failed request (network/429), only real answers, so a later retry can still succeed.
    p.then((r) => { if (r === undefined) searchCache.delete(key) }, () => searchCache.delete(key))
    searchCache.set(key, p.then((r) => r ?? null))
  }
  return searchCache.get(key)!
}

// undefined = couldn't ask (blocked / network); null = asked, no usable place.
async function osmSearch(query: string, near: Coordinates | null): Promise<Coordinates | null | undefined> {
  if (Date.now() < nominatimBlockedUntil) return photonSearch(query, near)
  const wait = nextNominatimAt - Date.now()
  nextNominatimAt = Math.max(Date.now(), nextNominatimAt) + NOMINATIM_GAP_MS
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  const hit = await nominatimFetch(query, near).catch(() => undefined)
  if (hit === 'blocked') {
    nominatimBlockedUntil = Date.now() + BLOCKED_FOR_MS
    return photonSearch(query, near)
  }
  return hit
}

// Photon returns GeoJSON; like Nominatim's place_rank, area-sized results (a district's centroid can be tens of km
// from anything the caller named) are not a usable pin.
const PHOTON_TOO_COARSE = new Set(['country', 'state', 'county', 'district', 'state_district', 'region'])
async function photonSearch(query: string, near: Coordinates | null): Promise<Coordinates | null | undefined> {
  const params = new URLSearchParams({ q: query, limit: '1' })
  if (near) { params.set('lat', String(near.lat)); params.set('lon', String(near.lng)) }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params}`)
    if (!res.ok) return undefined
    const f = (await res.json())?.features?.[0]
    if (!f) return null
    // Judge size by the OSM tag (osm_value): Photon's own `type` calls a suburb like Kakkanad a "district".
    if (PHOTON_TOO_COARSE.has(String(f.properties?.osm_value ?? ''))) return null
    // Without a location hint Photon happily answers from another state ("Lake View Apartments" → Bangalore).
    if (near && distanceKm(near, { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }) > 150) return null
    const [lng, lat] = f.geometry?.coordinates ?? []
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  } catch {
    return undefined
  }
}

async function nominatimFetch(query: string, near: Coordinates | null): Promise<Coordinates | null | 'blocked'> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })
  // Bias (not restrict) results toward the caller's rough location so "12th Main Road" resolves in the right city.
  if (near) params.set('viewbox', [near.lng - 0.05, near.lat + 0.05, near.lng + 0.05, near.lat - 0.05].join(','))
  // Browsers send their own User-Agent; Node's default one is rejected by Nominatim's usage policy.
  const headers: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers })
  if (res.status === 429 || res.status === 403) return 'blocked'
  if (!res.ok) return null
  const [hit] = await res.json()
  if (!hit) return null
  if (typeof hit.place_rank === 'number' && hit.place_rank < MIN_USABLE_PLACE_RANK) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon) }
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

// A street/locality name spoken over voice can come through the Live API's transcription slightly garbled
// (e.g. "Vazhicherry" heard as "Vaicherry") — the full address string then fails to match anything. A pincode
// is far less likely to be misheard (it's read digit by digit) and Nominatim resolves it reliably on its own, so
// falling back to just "pincode, city" still lands in the right neighborhood even when the street name didn't.
function extractPincodeAndCity(address: string): string | null {
  const pinMatch = address.match(/\b\d{5,6}\b/)
  if (!pinMatch) return null
  const cityMatch = address.match(/,\s*([^,]+?)(?:,\s*pin\b|,\s*\d{5,6}\b|$)/i)
  return cityMatch ? `${pinMatch[0]}, ${cityMatch[1].trim()}` : pinMatch[0]
}

// Last resort when even the street/area name is too garbled to match anything: the town/city name alone (the
// last comma-separated part, or the whole string if there are no commas) is short and common enough that a
// mis-transcribed street ("Vaisheri" for "Vazhicherry") doesn't drag it down with it. Lands in the right town,
// not the right street — still far better than the caller's device GPS, which can be tens of km off.
function lastPlacePart(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  const last = parts.at(-1)?.replace(/-?\s*\d{5,6}\s*$/, '').trim()
  return last && last.length >= 3 ? last : null
}

// Last structured attempt before the bare-town fallback: callers join the town onto the road ("Alappuzha-
// Vazhicherry Market Road, Alappuzha") and add filler words, and Nominatim needs every word to match, so these
// fail outright even though "Vazhicherry Market, Alappuzha" resolves to the right neighbourhood. Clean up
// separators and the repeated town, then try progressively shorter phrases, then each distinctive word + town.
const FILLER = /^(road|rd|street|st|lane|junction|jn|near|nearby|opposite|opp|board|signboard|the|at|by|in|on|area|side|of)$/i
function relaxedQueries(address: string): string[] {
  const parts = address.replace(/[-/]+/g, ' ').split(',').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (parts.length < 2) return []
  const town = parts.at(-1)!.replace(/\s*\d{5,6}\s*$/, '').trim()
  const townRe = new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, '')}\\b`, 'gi')
  const words = parts.slice(0, -1).join(' ').replace(townRe, ' ').split(/\s+/).filter(Boolean)
  if (!words.length || !town) return []
  const out: string[] = []
  const add = (w: string[]) => { const q = `${w.join(' ')}, ${town}`; if (w.length && !out.includes(q) && q !== address) out.push(q) }
  for (let n = words.length; n >= 1; n--) add(words.slice(0, n))
  const distinctive = words.filter((w) => !FILLER.test(w) && w.length > 3)
  add(distinctive)
  for (const w of distinctive) add([w])
  return out.slice(0, 6)
}

// Nominatim requires every query token to roughly match — ONE mis-transcribed comma-separated segment (a street
// or area name misheard, e.g. "Vaisheri" for "Vazhicherry") can silently sink the whole query to zero hits, even
// when the OTHER segments include something specific and correct (a named landmark like "St George Auditorium").
// Confirmed in testing: "St. George Auditorium, Vaisheri, Alappuzha" finds nothing, but dropping the bad middle
// segment — "St. George Auditorium, Alappuzha" — finds the exact place immediately. Try dropping each segment in
// turn (keeping the others) rather than falling all the way back to just the town, since a landmark name is far
// more specific evidence of the caller's exact position than a town name alone.
function droppingOneSegment(address: string): string[] {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return [] // need at least landmark + something + town to be worth trying without the middle
  const out: string[] = []
  for (let i = 0; i < parts.length - 1; i++) { // never drop the last part (the town) — it anchors the search
    out.push(parts.filter((_, j) => j !== i).join(', '))
  }
  return out
}

export type GeocodeHit = Coordinates & {
  // 'exact': the full spoken address matched something, and (if a rough bias point existed) an unbiased search
  // agrees with the biased one, or none exists to disagree. 'approximate': only a pincode or the town/city
  // matched, OR the biased and unbiased searches disagreed and the unbiased one was trusted instead — either way
  // the pin is in the right general area, not verified down to the exact street. Consumers should mark an
  // 'approximate' hit as uncertain, not confirmed.
  precision: 'exact' | 'approximate'
}

// Verified against `near` bias silently overriding a genuinely correct match: bias is data Nominatim itself
// admits is only a "bias, not a restriction" — a short/ambiguous query (a bare town name, an area with no house
// number) can let it swing the result tens of km away from the real place, while still reporting as a normal,
// confident hit. Found in testing: "Alappuzha, Kerala" biased toward a bad Kochi-area point returned a Kochi
// street literally named "Alappuzha ... Road" instead of the real town, with no sign anything was wrong.
// The fix: ALWAYS also run the unbiased query. If both agree (within ~10km), the bias only helped disambiguate
// and the result is trusted as exact. If they disagree, the bias cannot be trusted to have picked correctly —
// prefer the unbiased match (closer to what the query text literally says) and mark it approximate, since we no
// longer have independent confirmation it's in the right specific area either.
const AGREEMENT_KM = 10

async function nominatimVerified(query: string, near: Coordinates | null): Promise<GeocodeHit | null> {
  const unbiased = await nominatimSearch(query, null)
  if (!near) return unbiased ? { ...unbiased, precision: 'exact' } : null

  const biased = await nominatimSearch(query, near)
  if (!biased) return unbiased ? { ...unbiased, precision: 'exact' } : null
  if (!unbiased) return { ...biased, precision: 'approximate' } // bias was the only result; can't cross-check it

  if (distanceKm(biased, unbiased) <= AGREEMENT_KM) return { ...biased, precision: 'exact' }
  return { ...unbiased, precision: 'approximate' }
}

// Callers (and the speech-to-text) still use the old English town names, but OpenStreetMap only knows the
// official ones: "Convent Square Junction, Alleppey" found nothing, and the looser fallbacks then pinned a
// different "convent" 1.2 km away (INC-MUWJYDV8). "Convent Square Junction, Alappuzha" is an exact hit.
const TOWN_NAMES: [RegExp, string][] = [
  [/\balleppey\b/gi, 'Alappuzha'], [/\bcochin\b/gi, 'Kochi'], [/\btrivandrum\b/gi, 'Thiruvananthapuram'],
  [/\bcalicut\b/gi, 'Kozhikode'], [/\btrichur\b/gi, 'Thrissur'], [/\bquilon\b/gi, 'Kollam'],
  [/\bcannanore\b/gi, 'Kannur'], [/\bpalghat\b/gi, 'Palakkad'], [/\bbangalore\b/gi, 'Bengaluru'],
  [/\bbombay\b/gi, 'Mumbai'], [/\bmadras\b/gi, 'Chennai'],
]
const officialNames = (address: string) => TOWN_NAMES.reduce((a, [re, name]) => a.replace(re, name), address)

// A fallback match more than this far from where the caller is known to be is a same-named place elsewhere.
const FALLBACK_MAX_KM = 25

async function viaNominatim(spoken: string, near: Coordinates | null): Promise<GeocodeHit | null> {
  const address = officialNames(spoken)
  const direct = await nominatimVerified(address, near)
  if (direct) return direct

  // Try dropping one mis-transcribed segment at a time before falling back to just the town — this can still
  // land on the exact landmark (a specific place, not just a general area) even when one part of what the
  // caller said didn't come through clearly.
  // Shorter phrases are loose ("Convent, Alappuzha" is any convent), so they are searched near the caller and a
  // hit far from them is ignored.
  for (const variant of [...droppingOneSegment(address), ...relaxedQueries(address)]) {
    const hit = await nominatimSearch(variant, near)
    if (hit && (!near || distanceKm(near, hit) <= FALLBACK_MAX_KM)) return { ...hit, precision: 'approximate' }
  }

  // These two fallbacks are deliberately unambiguous ON THEIR OWN (a 6-digit pincode; a named town/city), so
  // there is nothing for a bias to usefully disambiguate — cross-checking would just cost an extra request for
  // no benefit. Bias is skipped entirely here, not just cross-checked, since these queries don't need it.
  const pincodeQuery = extractPincodeAndCity(address)
  if (pincodeQuery) {
    const hit = await nominatimSearch(pincodeQuery, null)
    if (hit) return { ...hit, precision: 'approximate' }
  }

  const town = lastPlacePart(address)
  if (town && town !== address) {
    const hit = await nominatimSearch(town, null)
    if (hit) return { ...hit, precision: 'approximate' }
  }
  return null
}

// Google Geocoding when a key with Geocoding access is supplied, otherwise (or on failure) free OpenStreetMap Nominatim.
export async function geocodeAddress(
  address: string,
  opts: { near?: Coordinates | null; googleMapsKey?: string } = {},
): Promise<GeocodeHit | null> {
  try {
    if (opts.googleMapsKey) {
      const hit = await viaGoogle(address, opts.googleMapsKey).catch(() => null)
      if (hit) return { ...hit, precision: 'exact' }
    }
    return await viaNominatim(address, opts.near ?? null)
  } catch {
    return null
  }
}
