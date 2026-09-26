import { useMemo, useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'

// Epic 17.3: drag to any point in the call and see the transcript, extracted fields, and voice stress as they
// stood at that instant — reconstructs the call without cross-referencing the transcript, fields and stress
// trend separately by eye. Only shown once a case is consolidated (a live call already shows all of this on the
// case board and in the conversation panel).
const EMPTY_TRANSCRIPT: NonNullable<Incident['transcriptLines']> = []
const EMPTY_HISTORY: NonNullable<Incident['fieldHistory']> = []

export default function ReplayScrubber({ incident }: { incident: Incident }) {
  const transcript = incident.transcriptLines ?? EMPTY_TRANSCRIPT
  const fieldHistory = incident.fieldHistory ?? EMPTY_HISTORY
  const stressTrend = incident.voiceStressTrend

  const startMs = Date.parse(incident.sessionStartedAt)
  const endMs = incident.sessionEndedAt ? Date.parse(incident.sessionEndedAt) : startMs
  const durationS = Math.max(1, Math.round((endMs - startMs) / 1000))

  const [t, setT] = useState(durationS)

  const cutoffMs = startMs + t * 1000

  const transcriptUpTo = useMemo(
    () => transcript.filter((line) => Date.parse(line.at) <= cutoffMs),
    [transcript, cutoffMs],
  )
  const fieldsAt = useMemo(() => {
    let latest: Incident['extractedFieldsLive'] | null = null
    for (const entry of fieldHistory) {
      if (Date.parse(entry.at) <= cutoffMs) latest = entry.fields
      else break
    }
    return latest
  }, [fieldHistory, cutoffMs])
  const stressAt = useMemo(() => {
    let latest: number | null = null
    for (const entry of stressTrend) {
      if (Date.parse(entry.timestamp) <= cutoffMs) latest = entry.score
      else break
    }
    return latest
  }, [stressTrend, cutoffMs])

  if (transcript.length === 0 && fieldHistory.length === 0) return null

  return (
    <div className="card replay-card">
      <h2>Replay this call</h2>
      <p className="sub">Drag to any moment to see what was known then.</p>
      <input
        type="range"
        min={0}
        max={durationS}
        value={t}
        onChange={(e) => setT(Number(e.target.value))}
        className="replay-slider"
      />
      <div className="replay-time mono">
        +{Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')} / {Math.floor(durationS / 60)}:{String(durationS % 60).padStart(2, '0')}
      </div>

      <div className="replay-grid">
        <div className="replay-col">
          <h3>Transcript so far</h3>
          <ul className="replay-transcript">
            {transcriptUpTo.length === 0 && <li className="muted">Nothing said yet.</li>}
            {transcriptUpTo.map((line, i) => (
              <li key={`${line.at}-${i}`}>
                <strong>{line.speaker}:</strong> {line.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="replay-col">
          <h3>Fields known then</h3>
          {fieldsAt ? (
            <dl className="fields">
              <dt>People</dt>
              <dd>{fieldsAt.peopleCount ?? '—'}</dd>
              <dt>Danger indicators</dt>
              <dd>{fieldsAt.dangerIndicators.length ? fieldsAt.dangerIndicators.join(', ') : '—'}</dd>
              <dt>Urgency</dt>
              <dd>{fieldsAt.urgency ?? '—'}</dd>
              <dt>Voice stress</dt>
              <dd>{stressAt ?? '—'}</dd>
            </dl>
          ) : (
            <p className="muted">Nothing extracted yet at this point.</p>
          )}
        </div>
      </div>
    </div>
  )
}
