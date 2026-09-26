// Epic 16.6: once an incident's location is confirmed, look up nearby police, fire and hospital services so a
// responder doesn't have to search for who to actually dispatch. Free OpenStreetMap Overpass API — no billing,
// consistent with the project's existing free-tier-first pattern (Nominatim geocoding, free map tiles).

export type ServiceKind = 'police' | 'fire' | 'hospital'

export type NearbyService = {
  kind: ServiceKind
  name: string
  lat: number
  lng: number
  phone: string | null
  distanceKm: number
}

// The free public Overpass instance occasionally rate-limits or times out — try a second mirror before giving up,
// rather than leaving the card permanently stuck on "couldn't load" for what's often a transient issue.
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const RADIUS_M = 5_000
// Short: this is one of two-plus mirrors tried in a race (see nearbyServices()) — a slow/dead mirror should give
// up quickly so a working one isn't waited behind, not sit for the full 10s that made routing feel slow overall.
const REQUEST_TIMEOUT_MS = 4_000

const QUERY_TAGS: Record<ServiceKind, string> = {
  police: 'amenity=police',
  fire: 'amenity=fire_station',
  hospital: 'amenity=hospital',
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

type OverpassElement = { tags?: Record<string, string>; lat: number; lon: number }

async function queryOverpass(url: string, query: string): Promise<{ elements: OverpassElement[] } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      // Overpass rejects requests without a User-Agent; browsers send one, Node (simulate-call script) doesn't.
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}),
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const NOMINATIM_TYPES: Record<ServiceKind, string> = { police: 'police', fire: 'fire_station', hospital: 'hospital' }

async function viaNominatim(near: { lat: number; lng: number }): Promise<{ elements: OverpassElement[] } | null> {
  const d = 0.045 // ~5 km box
  const viewbox = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(',')
  const headers: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}
  const elements: OverpassElement[] = []
  for (const [kind, amenity] of Object.entries(NOMINATIM_TYPES)) {
    try {
      const params = new URLSearchParams({ amenity, format: 'jsonv2', viewbox, bounded: '1', limit: '5', extratags: '1' })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers })
      if (!res.ok) continue
      const hits = (await res.json()) as { lat: string; lon: string; name?: string; extratags?: Record<string, string> }[]
      for (const h of hits) {
        elements.push({ lat: Number(h.lat), lon: Number(h.lon), tags: { amenity: NOMINATIM_TYPES[kind as ServiceKind], name: h.name ?? '', phone: h.extratags?.phone ?? '' } })
      }
    } catch {
      // try the next kind
    }
  }
  return elements.length ? { elements } : null
}

// Cached by rounded position (~100m grid cell) for a short while: a call routes/re-routes several times as the
// caller moves and the same nearby stations are correct each time, but this was being re-fetched from Overpass
// on every single call (bestSafeRoute calls this internally, on top of the dashboard's own direct call for the
// "Nearby help" tile) — each one paying the full slow-Overpass-mirror cost again for the same answer. This was
// the single largest cause of routing feeling slow; caching it removes almost all of that repeated cost.
const CACHE_MS = 5 * 60_000
const cache = new Map<string, { at: number; promise: Promise<NearbyService[]> }>()
const cacheKey = (near: { lat: number; lng: number }) => `${near.lat.toFixed(3)},${near.lng.toFixed(3)}`

export function nearbyServices(near: { lat: number; lng: number }): Promise<NearbyService[]> {
  const key = cacheKey(near)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise
  const promise = fetchNearbyServices(near)
  cache.set(key, { at: Date.now(), promise })
  // A failed lookup shouldn't be cached as if it succeeded — the next call gets a fresh attempt.
  promise.catch(() => cache.delete(key))
  return promise
}

// One Overpass query covering all three service kinds at once, to stay within the free public instance's rate
// limits rather than firing three separate requests per incident view. Races each mirror (see below).
async function fetchNearbyServices(near: { lat: number; lng: number }): Promise<NearbyService[]> {
  const filters = Object.values(QUERY_TAGS)
    .map((tag) => `node[${tag}](around:${RADIUS_M},${near.lat},${near.lng});`)
    .join('')
  const query = `[out:json][timeout:15];(${filters});out body;`

  // Mirrors are independent alternatives, not an ordered fallback chain — start all of them at once and use
  // whichever gives a real (non-null) answer FIRST, rather than trying one at a time (which used to wait out one
  // dead mirror's full timeout before even starting the next — sequential trying, not any single slow request,
  // was the main cause of routing feeling slow). A plain Promise.race would resolve on the first mirror to
  // settle even if it fails, so this races each mirror's promise chained with "if null, wait forever" — the
  // overall race then only resolves early on an actual hit, and still finishes (with null) once every mirror has
  // failed, via the plain Promise.all fallback below.
  const firstHit = new Promise<{ elements: OverpassElement[] } | null>((resolve) => {
    let remaining = OVERPASS_URLS.length
    for (const url of OVERPASS_URLS) {
      void queryOverpass(url, query).then((d) => {
        if (d) resolve(d)
        else if (--remaining === 0) resolve(null)
      })
    }
  })
  let data = await firstHit
  // The free Overpass instances time out (504) under load — fall back to Nominatim's amenity search, which is
  // separate infrastructure and far more reliable, rather than reporting "no stations" that do exist.
  if (!data) data = await viaNominatim(near)
  if (!data) throw new Error('No station lookup service reachable')

  const results: NearbyService[] = (data.elements ?? [])
    .map((el: OverpassElement) => {
      const tags = el.tags ?? {}
      const kind: ServiceKind | null = tags.amenity === 'police' ? 'police' : tags.amenity === 'fire_station' ? 'fire' : tags.amenity === 'hospital' ? 'hospital' : null
      if (!kind) return null
      const point = { lat: el.lat, lng: el.lon }
      return {
        kind,
        name: tags.name || (kind === 'police' ? 'Police station' : kind === 'fire' ? 'Fire station' : 'Hospital'),
        lat: point.lat,
        lng: point.lng,
        phone: tags.phone || tags['contact:phone'] || null,
        distanceKm: haversineKm(near, point),
      }
    })
    .filter((r: NearbyService | null): r is NearbyService => r !== null)
    .sort((a: NearbyService, b: NearbyService) => a.distanceKm - b.distanceKm)

  // Nearest of each kind first (a responder scanning quickly wants one of each, not five of the same kind).
  const seen = new Set<ServiceKind>()
  const leading: NearbyService[] = []
  const rest: NearbyService[] = []
  for (const r of results) {
    if (!seen.has(r.kind)) {
      seen.add(r.kind)
      leading.push(r)
    } else {
      rest.push(r)
    }
  }
  return [...leading, ...rest].slice(0, 9)
}

// Epic 16.6: which service type to lead with, based on what's already known about the incident — a highlight/
// ordering hint, not a hard rule.
export function suggestedServiceKind(dangerIndicators: string[]): ServiceKind {
  const text = dangerIndicators.join(' ').toLowerCase()
  if (/fire|smoke|gas|explosion|blast/.test(text)) return 'fire'
  if (/injur|blood|stab|gunshot|hurt|bleeding/.test(text)) return 'hospital'
  return 'police'
}

// The most recognisable named place within ~60 m of a point (a shop, temple, bank, bus stop, petrol pump...), so a
// spoken turn can say "turn right at the Federal Bank" instead of a bare "turn right". Null if none or unreachable.
export async function landmarkNear(p: { lat: number; lng: number }): Promise<string | null> {
  const q = `[out:json][timeout:8];(nwr(around:60,${p.lat},${p.lng})[name][~"^(amenity|shop|tourism|leisure|highway|railway|building|office|historic)$"~"."];);out center 15;`
  for (const url of OVERPASS_URLS) {
    const data = await queryOverpass(url, q)
    if (!data) continue
    const rank = (t: Record<string, string>) => (t.amenity === 'fuel' || t.amenity === 'place_of_worship' || t.amenity === 'bank' || t.highway === 'traffic_signals' || t.highway === 'bus_stop' ? 0 : t.amenity || t.shop ? 1 : 2)
    const best = data.elements
      .map((e) => ({ t: e.tags ?? {}, lat: e.lat ?? (e as { center?: { lat: number } }).center?.lat, lng: e.lon ?? (e as { center?: { lon: number } }).center?.lon }))
      .filter((e) => e.t.name && e.lat != null)
      .sort((a, b) => rank(a.t) - rank(b.t) || haversineKm(p, a as { lat: number; lng: number }) - haversineKm(p, b as { lat: number; lng: number }))[0]
    if (!best) return null
    const kind = best.t.amenity ?? best.t.shop ?? best.t.highway ?? best.t.tourism ?? ''
    return `${best.t.name}${kind ? ` (${kind.replace(/_/g, ' ')})` : ''}`
  }
  return null
}

export type LandmarkHit = { lat: number; lng: number; name: string; confidence: 'high' | 'low' }

// Places a landmark the caller names ("St. George Auditorium", "Convent Square junction") on the map, searching
// only near where they were last known (they can't have jumped across town). Used when there's no precise GPS,
// so their position — and the route — follow what they report. Null if nothing matching is found nearby.
// `confidence` is 'low' when the match is weak enough that Mia should read it back and confirm rather than treat
// it as settled: a single generic keyword left after filtering, a hit near the edge of the 3 km search radius (it
// could just as easily be a same-named place further out that got missed), or the weaker Nominatim fallback path
// rather than an exact OSM name match.
export async function locateLandmark(text: string, near: { lat: number; lng: number }): Promise<LandmarkHit | null> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|near|junction|board|road|saw|see|seeing|front|of|and|now|currently|showing|something|like|sign|signboard|im|am)$/.test(w))
    .slice(0, 3)
  if (!words.length) return null
  const weakMatch = words.length < 2
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\"]/g, '')).join('.*')
  const q = `[out:json][timeout:10];nwr(around:3000,${near.lat},${near.lng})[name~"${pattern}",i];out center 10;`
  for (const url of OVERPASS_URLS) {
    const data = await queryOverpass(url, q)
    if (!data) continue
    const hits = data.elements
      .map((e) => ({ name: e.tags?.name ?? '', lat: e.lat ?? (e as { center?: { lat: number } }).center?.lat, lng: e.lon ?? (e as { center?: { lon: number } }).center?.lon }))
      .filter((h): h is { name: string; lat: number; lng: number } => h.lat != null && h.lng != null)
      .sort((a, b) => haversineKm(near, a) - haversineKm(near, b))
    if (hits[0]) {
      const farFromAnchor = haversineKm(near, hits[0]) > 1.5
      return { ...hits[0], confidence: weakMatch || farFromAnchor ? 'low' : 'high' }
    }
    break
  }
  // Fallback: Nominatim search bounded to ~3 km around the last known position. Always 'low' confidence — this
  // path only runs when the more specific Overpass name match found nothing, so it's a looser free-text guess.
  const d = 0.03
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&bounded=1&viewbox=${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}&q=${encodeURIComponent(words.join(' '))}`
  try {
    const res = await fetch(url, typeof window === 'undefined' ? { headers: { 'User-Agent': 'QuickBite-hackathon-prototype' } } : {})
    const [hit] = res.ok ? await res.json() : []
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), name: hit.display_name?.split(',')[0] ?? words.join(' '), confidence: 'low' } : null
  } catch {
    return null
  }
}
