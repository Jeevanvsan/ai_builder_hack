import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { DEMO_INCIDENTS, setDemoMode } from '../../../shared/incidents/client.ts'
import { affirmed } from '../../../shared/incidents/severity.ts'
import type { Incident } from '../../../shared/incidents/types.ts'
import { db } from '../lib/firebase'

// Epic 25: the end of a hidden demo call. Shows the tester what a responder would have seen, read from the
// demoIncidents collection (the dashboard never reads it). Live, because the case summary lands a few seconds
// after the call ends.
export function DemoResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident, setIncident] = useState<Omit<Incident, 'id'> | null>(null)

  useEffect(() => {
    if (!id) return
    return onSnapshot(doc(db, DEMO_INCIDENTS, id), (snap) => setIncident((snap.data() as Omit<Incident, 'id'>) ?? null))
  }, [id])

  // Leave demo mode however the tester exits this page.
  useEffect(() => () => setDemoMode(false), [])

  const done = () => {
    setDemoMode(false)
    navigate('/', { replace: true })
  }

  const f = incident?.extractedFieldsLive
  const danger = f ? affirmed(f.dangerIndicators) : []
  const transcript = incident?.transcriptLines ?? []

  return (
    <div className="page demo-result">
      <p className="demo-badge">Demo call · nothing was sent to responders</p>
      <h1>What the responder would see</h1>
      {!incident ? (
        <p className="demo-muted">Loading the case…</p>
      ) : (
        <>
          <div className="demo-grid">
            <Fact label="Severity" value={incident.severity.toUpperCase()} tone={incident.severity} />
            <Fact label="Voice stress" value={incident.voiceStressScore != null ? `${incident.voiceStressScore}%` : '—'} />
            <Fact label="People" value={f?.peopleCount != null ? String(f.peopleCount) : '—'} />
            <Fact label="Urgency" value={f?.urgency ?? '—'} />
          </div>
          <Section title="Location">{incident.location.confirmed?.address ?? 'Not given'}</Section>
          <Section title="What's happening">
            {danger.length ? <div className="demo-tags">{danger.map((d) => <span key={d}>{d}</span>)}</div> : 'Nothing reported'}
          </Section>
          {incident.vehicle && <Section title="Vehicle">{incident.vehicle.number}{incident.vehicle.region ? ` · ${incident.vehicle.region}` : ''}</Section>}
          {incident.recommendation && <Section title="Recommended action">{incident.recommendation}</Section>}
          <Section title="Case summary">{incident.consolidatedSummary ?? 'Writing the summary…'}</Section>
          {transcript.length > 0 && (
            <Section title="Transcript">
              <div className="demo-transcript">
                {transcript.map((l, i) => <p key={i}><b>{l.speaker}:</b> {l.text}</p>)}
              </div>
            </Section>
          )}
        </>
      )}
      <button type="button" className="primary-btn" onClick={done}>Back to menu</button>
    </div>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`demo-fact${tone ? ` tone-${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="demo-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
