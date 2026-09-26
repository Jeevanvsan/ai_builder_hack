import type { Incident } from '../../../shared/incidents/types'
import { channelLabel } from './format'

export type TimelineEvent = { at: string; label: string; tone?: 'live' | 'high' | 'done' }

export function buildTimeline(i: Incident): TimelineEvent[] {
  const events: (TimelineEvent | null)[] = [
    { at: i.sessionStartedAt, label: `Session started (${channelLabel(i.channel).toLowerCase()})`, tone: 'live' },
    i.location.rough
      ? {
          at: i.location.rough.capturedAt,
          label: `Approximate location captured (${i.location.rough.source === 'gps' ? 'GPS' : 'IP fallback'})`,
        }
      : null,
    i.location.confirmed ? { at: i.location.confirmed.confirmedAt, label: `Address confirmed: ${i.location.confirmed.address}` } : null,
    i.response.acknowledgedAt ? { at: i.response.acknowledgedAt, label: `Acknowledged by ${i.response.acknowledgedBy ?? 'responder'}` } : null,
    i.sessionEndedAt ? { at: i.sessionEndedAt, label: 'Call ended' } : null,
    i.response.resolvedAt ? { at: i.response.resolvedAt, label: 'Resolved', tone: 'done' } : null,
    ...i.response.notes.map((n) => ({ at: n.at, label: `${n.responderId}: ${n.text}` })),
    // Advice the AI gave the caller, and any high-signal thing it saw/heard (Epic 10), surfaced on the timeline.
    ...(i.adviceGiven ?? []).map((a) => ({ at: a.at, label: `Advice to caller: ${a.text}` })),
    ...(i.sceneObservations ?? [])
      .filter((o) => /gunshot|scream|weapon|gun|fire|explosion|stab|blood|attack/i.test(`${o.kind} ${o.detail}`))
      .map((o) => ({
        at: o.at,
        label: `${o.source === 'sound' ? 'Heard' : 'Seen'}: ${o.kind}${o.detail ? ` — ${o.detail}` : ''}`,
        tone: 'high' as const,
      })),
  ]
  return events
    .filter((e): e is TimelineEvent => Boolean(e))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
