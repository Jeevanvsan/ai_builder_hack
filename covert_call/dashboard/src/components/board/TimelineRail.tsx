import type { Incident, Severity } from '../../../../shared/incidents/types'
import { buildTimeline } from '../../lib/timeline'
import BoardIcon from './BoardIcon'

const SEV_COLOR: Record<Severity, string> = { low: '#2b6cb0', medium: '#c47600', high: '#d92a3f' }
const TO_LEVEL = /→\s*(LOW|MEDIUM|HIGH)/i
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// The whole incident on one track: the line is coloured by severity over time (escalations from reasoningTrace are
// ◆ markers where the colour changes), and each event is an icon node placed at its real moment. Detail lives in a
// popover on hover/focus instead of rows of timestamped text.
export default function TimelineRail({ incident, live, now }: { incident: Incident; live: boolean; now: number }) {
  const events = buildTimeline(incident)
  const escalations = (incident.reasoningTrace ?? [])
    .map((r) => ({ at: r.at, text: r.text, level: (r.text.match(TO_LEVEL)?.[1]?.toLowerCase() ?? null) as Severity | null }))
    .filter((e): e is { at: string; text: string; level: Severity } => e.level !== null)

  const start = Date.parse(incident.sessionStartedAt)
  const lastEvent = Math.max(...events.map((e) => Date.parse(e.at)), ...escalations.map((e) => Date.parse(e.at)), start)
  const end = Math.max(live ? now : Date.parse(incident.sessionEndedAt ?? incident.sessionStartedAt), lastEvent, start + 1000)
  const pos = (iso: string) => ((Date.parse(iso) - start) / (end - start)) * 100

  // Severity starts low and steps up at each escalation — encoded as hard colour stops along the track.
  let level: Severity = 'low'
  const stops: string[] = [`${SEV_COLOR.low} 0%`]
  for (const e of escalations) {
    const p = pos(e.at)
    stops.push(`${SEV_COLOR[level]} ${p}%`, `${SEV_COLOR[e.level]} ${p}%`)
    level = e.level
  }
  stops.push(`${SEV_COLOR[level]} 100%`)

  // Nodes closer than ~4% apart alternate above/below the track so they never overlap.
  const placed: (ReturnType<typeof buildTimeline>[number] & { p: number; lane: number })[] = []
  for (const e of events) {
    const p = pos(e.at)
    const prev = placed[placed.length - 1]
    const lane = prev && p - prev.p < 4 ? (prev.lane + 1) % 2 : 0
    placed.push({ ...e, p, lane })
  }

  return (
    <div className="timeline-rail" aria-label="Incident timeline">
      <div className="rail-inner">
      <div className="rail-track" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }}>
        {live && <span className="rail-now" style={{ left: '100%' }} />}
      </div>
      {escalations.map((e) => (
        <button key={`esc-${e.at}`} type="button" className="rail-node rail-escalation" style={{ left: `${pos(e.at)}%`, color: SEV_COLOR[e.level] }} aria-label={e.text}>
          <BoardIcon name="escalation" size={14} />
          <span className="rail-pop"><strong>{clock(e.at)}</strong>{e.text}</span>
        </button>
      ))}
      {placed.map((e) => (
        <button
          key={`${e.at}-${e.label}`}
          type="button"
          className={`rail-node rail-event lane-${e.lane}${e.tone ? ` rail-${e.tone}` : ''}`}
          style={{ left: `${e.p}%` }}
          aria-label={`${clock(e.at)} ${e.label}`}
        >
          <BoardIcon name={e.kind} size={14} />
          <span className="rail-pop"><strong>{clock(e.at)}</strong>{e.label}</span>
        </button>
      ))}
      <div className="rail-ends">
        <span>{clock(incident.sessionStartedAt)}</span>
        <span>{live ? 'now' : clock(new Date(end).toISOString())}</span>
      </div>
      </div>
    </div>
  )
}
