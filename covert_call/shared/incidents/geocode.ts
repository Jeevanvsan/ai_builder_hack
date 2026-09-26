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

async function nominatimSearch(query: string, near: Coordinates | null): Promise<Coordinates | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })
  // Bias (not restrict) results toward the caller's rough location so "12th Main Road" resolves in the right city.
  if (near) params.set('viewbox', [near.lng - 0.05, near.lat + 0.05, near.lng + 0.05, near.lat - 0.05].join(','))
  // Browsers send their own User-Agent; Node's default one is rejected by Nominatim's usage policy.
  const headers: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers })
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

async function viaNominatim(address: string, near: Coordinates | null): Promise<GeocodeHit | null> {
  const direct = await nominatimVerified(address, near)
  if (direct) return direct

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
