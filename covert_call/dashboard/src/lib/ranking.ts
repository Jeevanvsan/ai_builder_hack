import type { Incident, ResponseStatus, Severity } from './types'

const severityWeight: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
const statusWeight: Record<ResponseStatus, number> = { new: 0, acknowledged: 1, in_progress: 2, resolved: 3 }

// Order: severity, then unclaimed before claimed, then live calls before ended, then longest-waiting first.
export function compareIncidents(a: Incident, b: Incident): number {
  return (
    severityWeight[a.severity] - severityWeight[b.severity] ||
    statusWeight[a.response.status] - statusWeight[b.response.status] ||
    Number(b.callState === 'active') - Number(a.callState === 'active') ||
    Date.parse(a.sessionStartedAt) - Date.parse(b.sessionStartedAt)
  )
}

export function rankOpenIncidents(incidents: Incident[]): Incident[] {
  return incidents.filter((i) => i.response.status !== 'resolved').sort(compareIncidents)
}
