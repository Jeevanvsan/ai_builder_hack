import type { Incident } from '../../../shared/incidents/types'

export type MapProps = {
  rough: Incident['location']['rough']
  confirmed: Incident['location']['confirmed']
  target: { lat: number; lng: number }
  // Non-interactive board backdrop: no drag/zoom/controls, so the incident pin stays centred under the case hub.
  backdrop?: boolean
}
