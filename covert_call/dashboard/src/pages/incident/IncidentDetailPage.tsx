import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import IncidentMap from '../../components/IncidentMap'
import LiveValue from '../../components/LiveValue'
import LiveVideo from '../../components/LiveVideo'
import NoteForm from '../../components/NoteForm'
import ResponseActions from '../../components/ResponseActions'
import StressMeter from '../../components/StressMeter'
import StressSparkline from '../../components/StressSparkline'
import { formatElapsed, formatTime, statusLabel } from '../../lib/format'
import { useIncident } from '../../lib/incidentsStore'
import { useResponder } from '../../lib/responderContext'
import { markViewed } from '../../lib/responseActions'
import { buildTimeline } from '../../lib/timeline'
import type { FieldConfidence } from '../../../../shared/incidents/types'
import { useNow } from '../../lib/useNow'

function Confidence({ level }: { level: FieldConfidence | undefined }) {
  if (!level) return null
  return <span className={`confidence confidence-${level}`}>{level}</span>
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const { data: incident, loading, error } = useIncident(id)
  const now = useNow()
  const { name } = useResponder()

  // Opening the incident clears its "new" highlight on every dashboard.
  const incidentId = incident?.id
  const viewedAt = incident?.response.viewedAt
  useEffect(() => {
    if (incidentId && viewedAt === null) void markViewed(incidentId, name)
  }, [incidentId, viewedAt, name])

  if (loading || error) {
    return (
      <section>
        <Link to="/" className="back-link">← Back to live queue</Link>
        <DataState loading={loading} error={error} />
      </section>
    )
  }

  if (!incident) {
    return (
      <section>
        <Link to="/" className="back-link">← Back to live queue</Link>
        <div className="page-head">
          <h1>Incident {id}</h1>
          <p className="muted">No incident with this ID.</p>
        </div>
      </section>
    )
  }

  const f = incident.extractedFieldsLive
  // A resolved case is never shown as a live call, even if the caller's session never reported ending.
  const live = incident.callState === 'active' && incident.response.status !== 'resolved'
  const conf = incident.fieldConfidence
  const back = incident.response.status === 'resolved'
    ? { to: '/history', label: 'Back to case history' }
    : { to: '/', label: 'Back to live queue' }
  const { rough, confirmed } = incident.location

  return (
    <section className={live ? 'detail detail-live' : 'detail detail-ended'}>
      <Link to={back.to} className="back-link">← {back.label}</Link>

      <div className="page-head detail-head">
        <div>
          <h1>
            <span className="mono">{incident.id}</span>
            <LiveValue value={incident.severity}>
              <Chip tone={incident.severity} filled>{incident.severity}</Chip>
            </LiveValue>
            <LiveValue value={incident.response.status}>
              <Chip tone={incident.response.status === 'new' ? 'new' : 'neutral'}>{statusLabel(incident.response.status)}</Chip>
            </LiveValue>
          </h1>
          <p className="muted">
            {incident.channel === 'live-call' ? 'Voice call' : 'Silent tap'} · started {formatTime(incident.sessionStartedAt)}
            {incident.response.acknowledgedBy && ` · handled by ${incident.response.acknowledgedBy}`}
          </p>
        </div>
        <div className="head-side">
          <ResponseActions incident={incident} />
          {live ? (
            <div className="call-banner call-live">
              <span className="live"><span className="live-dot" />Call in progress</span>
              <span className="mono call-timer">{formatElapsed(incident.sessionStartedAt, now)}</span>
            </div>
          ) : (
            <div className="call-banner call-ended">
              <span>Case record</span>
              <span className="sub">
              Call lasted {incident.sessionEndedAt ? formatElapsed(incident.sessionStartedAt, Date.parse(incident.sessionEndedAt)) : '—'}
            </span>
            </div>
          )}
        </div>
      </div>

      <div className={incident.video ? 'detail-grid has-video' : 'detail-grid'}>
        {incident.video && (
          <div className="card video-card">
            <div className="video-card-head">
              <h2>Live video</h2>
              <Link to={`/incident/${incident.id}/video`} className="btn btn-sm">Full screen</Link>
            </div>
            <LiveVideo incident={incident} />
          </div>
        )}
        <div className="card map-card">
          <h2>Location</h2>
          <IncidentMap location={incident.location} />
          <div className="location-lines">
            <div>
              <span className="legend legend-confirmed" />
              {confirmed ? (
                <LiveValue value={confirmed.address}>
                  <strong>{confirmed.address}</strong> <Confidence level={confirmed.confidence} />
                </LiveValue>
              ) : (
                <span className="muted-inline">Address not yet confirmed{live ? ', waiting on the caller' : ''}</span>
              )}
            </div>
            <div className="sub">
              <span className="legend legend-rough" />
              {rough
                ? `Approximate: ${rough.lat.toFixed(4)}, ${rough.lng.toFixed(4)} (${rough.source === 'gps' ? 'GPS' : 'IP fallback'})`
                : 'Approximate location: capturing…'}
            </div>
          </div>
        </div>

        <div className="card fields-card">
          <h2>Extracted fields</h2>
          <dl className="fields fields-lg">
            <dt>People present</dt>
            <dd><LiveValue value={f.peopleCount}>{f.peopleCount ?? <span className="pending">Listening…</span>}</LiveValue> <Confidence level={conf.peopleCount} /></dd>
            <dt>Danger indicators</dt>
            <dd>
              <LiveValue value={f.dangerIndicators}>
                {f.dangerIndicators.length
                  ? f.dangerIndicators.map((d) => <Chip key={d} tone="danger">{d}</Chip>)
                  : <span className="pending">{live ? 'Listening…' : 'None reported'}</span>}
              </LiveValue>
              <Confidence level={conf.dangerIndicators} />
            </dd>
            <dt>Urgency</dt>
            <dd><LiveValue value={f.urgency}>{f.urgency ?? <span className="pending">Listening…</span>}</LiveValue> <Confidence level={conf.urgency} /></dd>
            <dt>Notes</dt>
            <dd><LiveValue value={f.notes}>{f.notes ?? <span className="pending">—</span>}</LiveValue></dd>
          </dl>
        </div>

        <div className="card stress-card">
          <h2>Voice stress</h2>
          <LiveValue value={incident.voiceStressScore}>
            <StressMeter score={incident.voiceStressScore} />
          </LiveValue>
          <StressSparkline trend={incident.voiceStressTrend} live={live} />
        </div>

        <div className="card timeline-card">
          <h2>Timeline</h2>
          <ol className="timeline">
            {buildTimeline(incident).map((e) => (
              <li key={`${e.at}-${e.label}`} className={e.tone ? `tl-${e.tone}` : undefined}>
                <span className="tl-time mono">{new Date(e.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span>{e.label}</span>
              </li>
            ))}
          </ol>
          <NoteForm incidentId={incident.id} />
        </div>

        <div className="card summary-card">
          <h2>Consolidated summary</h2>
          {incident.consolidatedSummary ? (
            <>
              <LiveValue value={incident.consolidatedSummary}>
                <p className="summary">{incident.consolidatedSummary}</p>
              </LiveValue>
              {incident.leakageCheckStatus.reviewed && (
                <p className="sub">
                  Third-party check:{' '}
                  {incident.leakageCheckStatus.redactions.length
                    ? `redacted ${incident.leakageCheckStatus.redactions.join(', ')}`
                    : 'no redactions needed'}
                </p>
              )}
            </>
          ) : (
            <p className="pending">
              {live ? 'Written by Gemini once the call ends. Fields above update live until then.' : 'Consolidating the call…'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
