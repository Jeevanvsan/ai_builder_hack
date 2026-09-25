import type { RoughLocation } from './types.ts'

const now = () => new Date().toISOString()

// Resolves null if GPS is unavailable or denied. May stay pending while the permission prompt is open.
export function gpsLocation(): Promise<RoughLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps', capturedAt: now() }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

// Free, keyless, CORS-enabled IP geolocation services, tried in order; free tiers rate-limit, so one isn't enough.
const IP_PROVIDERS = [
  'https://get.geojs.io/v1/ip/geo.json',
  'https://ipwho.is/',
  'https://ipapi.co/json/',
]

// Coarse city-level fallback for laptops/PCs without GPS or when location permission is denied.
export async function ipLocation(): Promise<RoughLocation | null> {
  for (const url of IP_PROVIDERS) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      const lat = Number(data.latitude)
      const lng = Number(data.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        return { lat, lng, source: 'ip-fallback', capturedAt: now() }
      }
    } catch {
      // Try the next provider.
    }
  }
  return null
}
