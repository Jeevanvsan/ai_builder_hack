import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import ResponseActions from '../../components/ResponseActions'
import CaseBoard from '../../components/board/CaseBoard'
import DecodeText from '../../components/board/DecodeText'
import SidePanel from '../../components/board/SidePanel'
import TimelineRail from '../../components/board/TimelineRail'
import { playEscalationCue } from '../../lib/alertOutputs'
import { channelLabel, formatElapsed, formatTime, statusLabel } from '../../lib/format'
import { useIncident } from '../../lib/incidentsStore'
import { useAuth } from '../../lib/authContext'
import { responderLabel } from '../../lib/auth'
import { markViewed } from '../../lib/responseActions'
import { useChangesSinceLastView } from '../../lib/useChangesSinceLastView'
import { useNow } from '../../lib/useNow'

export default function IncidentDetailPage() {
  const { id } = useParams()
  const { data: incident, loading, error } = useIncident(id)
  const now = useNow()
  const { user, responder } = useAuth()
  const name = responderLabel(user, responder)

  // Opening the incident clears its "new" highlight on every dashboard.
  const incidentId = incident?.id
  const viewedAt = incident?.response.viewedAt
  useEffect(() => {
    if (incidentId && viewedAt === null) void markViewed(incidentId, name)
  }, [incidentId, viewedAt, name])

  // Epic 16.8: what changed since this browser last opened this incident.
  const changesSinceLastView = useChangesSinceLastView(incident)

  // Epic 16.7: a distinct cue the instant severity rises on the incident already open in front of this responder.
  const severity = incident?.severity
  const lastSeenSeverity = useRef<typeof severity>(undefined)
  useEffect(() => {
    if (severity === undefined) return
    if (lastSeenSeverity.current !== undefined && severity !== lastSeenSeverity.current) {
      const rank = { low: 0, medium: 1, high: 2 } as const
      if (rank[severity] > rank[lastSeenSeverity.current]) playEscalationCue()
    }
    lastSeenSeverity.current = severity
  }, [severity])

  if (loading || error || !incident) {
    return (
      <section>
        <Link to="/" className="back-link">← Back to live queue</Link>
        {loading || error ? <DataState loading={loading} error={error} /> : <p className="muted">No incident with this ID ({id}).</p>}
      </section>
    )
  }

  // A resolved case is never shown as a live call, even if the caller's session never reported ending.
  const live = incident.callState === 'active' && incident.response.status !== 'resolved'
  const back = incident.response.status === 'resolved' ? { to: '/history', label: 'Case history' } : { to: '/', label: 'Live queue' }
  const timer = live
    ? formatElapsed(incident.sessionStartedAt, now)
    : incident.sessionEndedAt ? formatElapsed(incident.sessionStartedAt, Date.parse(incident.sessionEndedAt)) : '—'

  return (
    <section className={`case-page ${live ? 'is-live' : 'is-ended'}`}>
      <header className="case-status">
        <Link to={back.to} className="case-back" aria-label={`Back to ${back.label}`}>←</Link>
        <div className="case-title">
          <div className="case-title-row">
            <span className="mono case-id">{incident.id}</span>
            <Chip tone={incident.severity} filled>{incident.severity}</Chip>
            <Chip tone={incident.response.status === 'new' ? 'new' : 'neutral'}>{statusLabel(incident.response.status)}</Chip>
            {incident.incidentType === 'sos' && <span className="sos-badge">SOS{incident.scenario ? ` · ${incident.scenario}` : ''}</span>}
          </div>
          <span className="sub">
            {channelLabel(incident.channel)} · started {formatTime(incident.sessionStartedAt)}
            {incident.response.acknowledgedBy && ` · handled by ${incident.response.acknowledgedBy}`}
          </span>
        </div>
        {incident.recommendation && (
          <div className={`case-recommendation rec-${incident.severity}`}>
            <span className="case-rec-label">AI recommends</span>
            <DecodeText text={incident.recommendation} className="case-rec-text" />
          </div>
        )}
        <div className="case-actions"><ResponseActions incident={incident} /></div>
      </header>

      {changesSinceLastView && <div className="diff-banner">Since you last checked: {changesSinceLastView.join(', ')}</div>}

      <div className="case-main">
        <CaseBoard incident={incident} live={live} now={now} timer={timer} />
        <SidePanel incident={incident} live={live} now={now} />
      </div>

      <TimelineRail incident={incident} live={live} now={now} />
    </section>
  )
}
