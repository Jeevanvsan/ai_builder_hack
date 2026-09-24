import type { Incident, ResponseStatus, Severity } from '../../../shared/incidents/types'

const severityWeight: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
const statusWeight: Record<ResponseStatus, number> = { new: 0, acknowledged: 1, in_progress: 2, resolved: 3 }

// Explicit null means "created, not yet opened by anyone"; older docs without the field count as seen.
export const isUnviewed = (i: Incident) => i.response.viewedAt === null && i.response.status !== 'resolved'

// Order: incidents nobody has opened yet (newest first), then severity, unclaimed before claimed,
// live calls before ended, longest-waiting first. A just-started call has no severity yet, so pinning it
// on top keeps it from sinking to the bottom as "low" before anyone has looked.
export function compareIncidents(a: Incident, b: Incident): number {
  const ua = isUnviewed(a)
  const ub = isUnviewed(b)
  if (ua !== ub) return ua ? -1 : 1
  if (ua && ub) return Date.parse(b.sessionStartedAt) - Date.parse(a.sessionStartedAt)
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
