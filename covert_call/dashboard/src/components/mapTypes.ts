import type { Incident } from '../../../shared/incidents/types'

export type MapProps = {
  rough: Incident['location']['rough']
  // Callers only ever pass a genuinely-pinned confirmed location here (lat/lng both non-null); an address that
  // failed to geocode is filtered out upstream (IncidentMap.tsx) rather than plotted at `null, null`.
  confirmed: { lat: number; lng: number; address: string } | null
  target: { lat: number; lng: number }
  // True when `target` is the caller's live track position (newer than the confirmed address).
  live?: boolean
  // Non-interactive board backdrop: no drag/zoom/controls, so the incident pin stays centred under the case hub.
  backdrop?: boolean
  // Live GPS trail and route to safety (drawn on the OSM map).
  track?: { lat: number; lng: number }[]
  route?: Incident['safeRoute']
}
