import type { Incident, TrackPoint } from '../../../shared/incidents/types'

export type MapProps = {
  rough: Incident['location']['rough']
  // Callers only ever pass a genuinely-pinned confirmed location here (lat/lng both non-null); an address that
  // failed to geocode is filtered out upstream (IncidentMap.tsx) rather than plotted at `null, null`.
  confirmed: { lat: number; lng: number; address: string } | null
  // accuracyM: the phone's accuracy radius when `target` is a GPS fix (drawn as a ring around the caller).
  target: { lat: number; lng: number; accuracyM?: number | null }
  // True when `target` is the caller's live track position (newer than the confirmed address).
  live?: boolean
  // Non-interactive board backdrop: no drag/zoom/controls, so the incident pin stays centred under the case hub.
  backdrop?: boolean
  // Live trail (GPS fixes, and places the caller named) and the route to safety.
  track?: TrackPoint[]
  route?: Incident['safeRoute']
}

// An accuracy ring smaller than this hides under the caller's own marker, so it isn't drawn.
export const MIN_RING_M = 15

// Destination marker colour per kind of station, shared by both maps.
export const DEST_COLOR = { police: '#2c4a9e', fire: '#b8391f', hospital: '#1f7a45' } as const

// How the Google map shows the area: the street map, satellite photos with labels, or photorealistic 3D.
export type MapView = 'map' | 'satellite' | '3d'
