import type { Incident } from './types.ts'

// A phone fix with a larger accuracy radius than this is a laptop or Wi-Fi guess (one put an Alappuzha caller near
// Kothamangalam): not a position to pin an address to, route from, or bias an address search around.
export const PRECISE_M = 100

export type DeviceFix = { lat: number; lng: number; at: string; accuracyM: number | null }

// Where the phone last measured itself to be, precisely: the newest GPS point of the live trail, else the start fix
// if that was a precise GPS fix. Never an IP fix, and never a trail point placed from a landmark the caller named
// (that is what they said, not a measurement). Points from before accuracy was stored count as precise, as before.
export function latestFix(loc: Incident['location'] | null | undefined): DeviceFix | null {
  if (!loc) return null
  const track = loc.track ?? []
  for (let k = track.length - 1; k >= 0; k--) {
    const t = track[k]
    if (t.source === 'landmark' || (t.accuracyM != null && t.accuracyM > PRECISE_M)) continue
    return { lat: t.lat, lng: t.lng, at: t.at, accuracyM: t.accuracyM ?? null }
  }
  const r = loc.rough
  if (r?.source === 'gps' && (r.accuracyM == null || r.accuracyM <= PRECISE_M)) {
    return { lat: r.lat, lng: r.lng, at: r.capturedAt, accuracyM: r.accuracyM ?? null }
  }
  return null
}
