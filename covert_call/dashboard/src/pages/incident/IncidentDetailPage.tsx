import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import CallRecordingPlayer from '../../components/CallRecordingPlayer'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import IncidentMap from '../../components/IncidentMap'
import LiveValue from '../../components/LiveValue'
import LiveTranscript from '../../components/LiveTranscript'
import LiveVideo from '../../components/LiveVideo'
import NearbyServicesCard from '../../components/NearbyServicesCard'
import NoteForm from '../../components/NoteForm'
import ReplayScrubber from '../../components/ReplayScrubber'
import ResponseActions from '../../components/ResponseActions'
import StressMeter from '../../components/StressMeter'
import StressSparkline from '../../components/StressSparkline'
import { playEscalationCue } from '../../lib/alertOutputs'
import BulletinCard from '../../components/BulletinCard'
import { channelLabel, formatElapsed, formatTime, statusLabel } from '../../lib/format'
import { useIncident } from '../../lib/incidentsStore'
import { useAuth } from '../../lib/authContext'
import { responderLabel } from '../../lib/auth'
import { markViewed } from '../../lib/responseActions'
import { buildTimeline } from '../../lib/timeline'
import { useChangesSinceLastView } from '../../lib/useChangesSinceLastView'
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

  // Epic 16.7: a distinct cue the instant severity increases on the incident already open in front of this
  // responder — deliberately independent of Epic 4.6's "do not disturb while on an incident page" rule, since
  // that rule protects a responder working a *different* incident, not this exact one escalating right now.
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
  // Epic 16.2: while live, show confidence as it sharpens during the call; once consolidated, the permanent
  // post-call `fieldConfidence` takes over (it may re-grade something the live pass only guessed at).
  const conf = live ? (incident.fieldConfidenceLive ?? {}) : incident.fieldConfidence
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
            {incident.incidentType === 'sos' && (
              <span className="sos-badge">SOS{incident.scenario ? ` · ${incident.scenario}` : ''}</span>
            )}
            {channelLabel(incident.channel)} · started {formatTime(incident.sessionStartedAt)}
            {incident.cameraMode && ` · cameras: ${incident.cameraMode}`}
            {incident.response.acknowledgedBy && ` · handled by ${incident.response.acknowledgedBy}`}
          </p>
          {incident.recommendation && (
            <LiveValue value={incident.recommendation}>
              <p className={`recommendation recommendation-${incident.severity}`}>{incident.recommendation}</p>
            </LiveValue>
          )}
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

      {changesSinceLastView && (
        <div className="diff-banner">
          Since you last checked: {changesSinceLastView.join(', ')}
        </div>
      )}

      <div className={incident.video || incident.videoFront ? 'detail-grid has-video' : 'detail-grid'}>
        {(incident.video || incident.videoFront) && (
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
            {incident.groundedContext && (
              <LiveValue value={incident.groundedContext}>
                <div className="sub grounded-context">{incident.groundedContext}</div>
              </LiveValue>
            )}
          </div>
        </div>

        <div className="card fields-card">
          <h2>Extracted fields</h2>
          <dl className="fields fields-lg">
            <dt>People present</dt>
            <dd><LiveValue value={f.peopleCount}>{f.peopleCount ?? <span className="pending">{live ? 'Listening…' : 'Not reported'}</span>}</LiveValue> <Confidence level={conf.peopleCount} /></dd>
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
            <dd><LiveValue value={f.urgency}>{f.urgency ?? <span className="pending">{live ? 'Listening…' : 'Not reported'}</span>}</LiveValue> <Confidence level={conf.urgency} /></dd>
            <dt>Notes</dt>
            <dd><LiveValue value={f.notes}>{f.notes ?? <span className="pending">—</span>}</LiveValue></dd>
          </dl>
        </div>

        {confirmed && (
          <NearbyServicesCard location={{ lat: confirmed.lat, lng: confirmed.lng }} dangerIndicators={f.dangerIndicators} />
        )}

        {live && incident.transcriptLines && incident.transcriptLines.length > 0 && (
          <LiveTranscript lines={incident.transcriptLines} />
        )}

        {incident.reasoningTrace && incident.reasoningTrace.length > 0 && (
          <div className="card reasoning-card">
            <h2>Why this severity</h2>
            <p className="sub">What triggered each change, as it happened — not just the resulting chip.</p>
            <ol className="reasoning-trace">
              {incident.reasoningTrace.map((r, idx) => (
                <li key={`${r.at}-${idx}`}>
                  <span className="tl-time mono">
                    {new Date(r.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {incident.sceneObservations && incident.sceneObservations.length > 0 && (
          <div className="card scene-card">
            <h2>Seen &amp; heard</h2>
            <p className="sub">What the AI observed on camera or in the background — separate from what the caller said.</p>
            <ul className="scene-list">
              {incident.sceneObservations.map((o, idx) => (
                <li key={`${o.at}-${idx}`}>
                  <span className={`scene-tag scene-${o.source}`}>{o.source === 'sound' ? 'Heard' : 'Seen'}</span>
                  <span className="scene-kind">{o.kind}</span>
                  {o.detail && <span className="scene-detail">{o.detail}</span>}
                  <span className="scene-time mono">
                    {new Date(o.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {incident.hasRecording && (
          <div className="card recording-card">
            <h2>Call recording</h2>
            <CallRecordingPlayer incidentId={incident.id} />
            <p className="sub">Full call audio (mic + AI voice), for evidence and verification. Playable anytime.</p>
          </div>
        )}

        {incident.videoRecording && incident.videoRecording.length > 0 && (
          <div className="card recording-card">
            <h2>Call video</h2>
            <ul className="drive-videos">
              {incident.videoRecording.map((v) => (
                <li key={v.camera}>
                  <span className="drive-cam">{v.camera === 'front' ? 'Front camera' : 'Back camera'}</span>
                  {v.status === 'uploaded' && v.driveUrl ? (
                    <a className="btn btn-sm" href={v.driveUrl} target="_blank" rel="noreferrer">Open in Drive</a>
                  ) : v.status === 'recording' ? (
                    <span className="sub">Uploading…</span>
                  ) : (
                    <span className="sub">Upload failed</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="sub">Saved to the team's Google Drive for later review.</p>
          </div>
        )}

        {!live && incident.consolidatedSummary && <ReplayScrubber incident={incident} />}

        {incident.bulletin && <BulletinCard incidentId={incident.id} bulletin={incident.bulletin} />}

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
