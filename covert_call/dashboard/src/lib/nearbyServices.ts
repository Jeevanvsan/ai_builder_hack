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
const REQUEST_TIMEOUT_MS = 10_000

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

// One Overpass query covering all three service kinds at once, to stay within the free public instance's rate
// limits rather than firing three separate requests per incident view. Tries each mirror in turn.
export async function nearbyServices(near: { lat: number; lng: number }): Promise<NearbyService[]> {
  const filters = Object.values(QUERY_TAGS)
    .map((tag) => `node[${tag}](around:${RADIUS_M},${near.lat},${near.lng});`)
    .join('')
  const query = `[out:json][timeout:15];(${filters});out body;`

  let data: { elements: OverpassElement[] } | null = null
  for (const url of OVERPASS_URLS) {
    data = await queryOverpass(url, query)
    if (data) break
  }
  if (!data) return []

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
