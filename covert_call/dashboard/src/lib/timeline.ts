import type { Incident } from './types'

export type TimelineEvent = { at: string; label: string; tone?: 'live' | 'high' | 'done' }

export function buildTimeline(i: Incident): TimelineEvent[] {
  const events: (TimelineEvent | null)[] = [
    { at: i.sessionStartedAt, label: `Session started (${i.channel === 'live-call' ? 'voice call' : 'silent tap'})`, tone: 'live' },
    {
      at: i.location.rough.capturedAt,
      label: `Approximate location captured (${i.location.rough.source === 'gps' ? 'GPS' : 'IP fallback'})`,
    },
    i.location.confirmed ? { at: i.location.confirmed.confirmedAt, label: `Address confirmed: ${i.location.confirmed.address}` } : null,
    i.response.acknowledgedAt ? { at: i.response.acknowledgedAt, label: `Acknowledged by ${i.response.acknowledgedBy ?? 'responder'}` } : null,
    i.sessionEndedAt ? { at: i.sessionEndedAt, label: 'Call ended' } : null,
    i.response.resolvedAt ? { at: i.response.resolvedAt, label: 'Resolved', tone: 'done' } : null,
    ...i.response.notes.map((n) => ({ at: n.at, label: `${n.responderId}: ${n.text}` })),
  ]
  return events
    .filter((e): e is TimelineEvent => Boolean(e))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
