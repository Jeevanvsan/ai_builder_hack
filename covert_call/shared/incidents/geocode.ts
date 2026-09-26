export type Coordinates = { lat: number; lng: number }

async function viaGoogle(address: string, key: string): Promise<Coordinates | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const data = await (await fetch(url)).json()
  const loc = data.status === 'OK' ? data.results?.[0]?.geometry?.location : null
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

async function nominatimSearch(query: string, near: Coordinates | null): Promise<Coordinates | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })
  // Bias (not restrict) results toward the caller's rough location so "12th Main Road" resolves in the right city.
  // Tighter than before (~0.05deg, ~5km) — a wide box let unrelated same-named streets in far-off areas win.
  if (near) params.set('viewbox', [near.lng - 0.05, near.lat + 0.05, near.lng + 0.05, near.lat - 0.05].join(','))
  // Browsers send their own User-Agent; Node's default one is rejected by Nominatim's usage policy.
  const headers: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers })
  if (!res.ok) return null
  const [hit] = await res.json()
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
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

export type GeocodeHit = Coordinates & {
  // 'exact': the full spoken address matched something. 'approximate': only a pincode or the town/city name
  // matched — the street itself couldn't be found (likely mis-transcribed), so the pin is in the right area but
  // not necessarily the right street. Consumers should mark an 'approximate' hit as uncertain, not confirmed.
  precision: 'exact' | 'approximate'
}

async function viaNominatim(address: string, near: Coordinates | null): Promise<GeocodeHit | null> {
  const direct = await nominatimSearch(address, near)
  if (direct) return { ...direct, precision: 'exact' }

  const pincodeQuery = extractPincodeAndCity(address)
  if (pincodeQuery) {
    const hit = await nominatimSearch(pincodeQuery, near)
    if (hit) return { ...hit, precision: 'approximate' }
  }

  const town = lastPlacePart(address)
  if (town && town !== address) {
    const hit = await nominatimSearch(town, near)
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
