import type { Incident } from '../../../shared/incidents/types'

export type MapProps = {
  rough: Incident['location']['rough']
  confirmed: Incident['location']['confirmed']
  target: { lat: number; lng: number }
}
