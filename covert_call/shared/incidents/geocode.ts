export type Coordinates = { lat: number; lng: number }

async function viaGoogle(address: string, key: string): Promise<Coordinates | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const data = await (await fetch(url)).json()
  const loc = data.status === 'OK' ? data.results?.[0]?.geometry?.location : null
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

async function viaNominatim(address: string, near: Coordinates | null): Promise<Coordinates | null> {
  const params = new URLSearchParams({ q: address, format: 'jsonv2', limit: '1' })
  // Bias (not restrict) results toward the caller's rough location so "12th Main Road" resolves in the right city.
  if (near) params.set('viewbox', [near.lng - 0.3, near.lat + 0.3, near.lng + 0.3, near.lat - 0.3].join(','))
  // Browsers send their own User-Agent; Node's default one is rejected by Nominatim's usage policy.
  const headers: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'QuickBite-hackathon-prototype' } : {}
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers })
  if (!res.ok) return null
  const [hit] = await res.json()
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

// Google Geocoding when a key with Geocoding access is supplied, otherwise (or on failure) free OpenStreetMap Nominatim.
export async function geocodeAddress(
  address: string,
  opts: { near?: Coordinates | null; googleMapsKey?: string } = {},
): Promise<Coordinates | null> {
  try {
    if (opts.googleMapsKey) {
      const hit = await viaGoogle(address, opts.googleMapsKey).catch(() => null)
      if (hit) return hit
    }
    return await viaNominatim(address, opts.near ?? null)
  } catch {
    return null
  }
}
