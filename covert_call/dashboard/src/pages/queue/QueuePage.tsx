import { Link, useNavigate } from 'react-router-dom'
import Chip from '../../components/Chip'
import StressMeter from '../../components/StressMeter'
import DataState from '../../components/DataState'
import { useIncidents } from '../../lib/incidentsStore'
import { rankOpenIncidents } from '../../lib/ranking'
import { formatElapsed, formatTime, statusLabel, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/useNow'

export default function QueuePage() {
  const now = useNow()
  const navigate = useNavigate()
  const { data, loading, error } = useIncidents()
  const queue = rankOpenIncidents(data)

  const stats = [
    { label: 'Open incidents', value: queue.length },
    { label: 'High severity', value: queue.filter((i) => i.severity === 'high').length, tone: 'high' },
    { label: 'Unclaimed', value: queue.filter((i) => i.response.status === 'new').length, tone: 'medium' },
    { label: 'Live calls', value: queue.filter((i) => i.callState === 'active').length, tone: 'live' },
  ]

  return (
    <section>
      <div className="page-head">
        <h1>Live queue</h1>
        <p className="muted">Ranked by severity, then unclaimed, then live calls, then longest waiting. Updates live from Firestore.</p>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`stat${s.tone ? ` stat-${s.tone}` : ''}`}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {loading || error ? (
        <DataState loading={loading} error={error} />
      ) : queue.length === 0 ? (
        <div className="card empty">No open incidents.</div>
      ) : (
        <table className="table queue">
          <thead>
            <tr>
              <th>#</th>
              <th>Severity</th>
              <th>Incident</th>
              <th>Status</th>
              <th>Call</th>
              <th>People</th>
              <th>Danger indicators</th>
              <th>Voice stress</th>
              <th>Location</th>
              <th>Elapsed</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((i, index) => {
              const f = i.extractedFieldsLive
              const needsAttention = i.response.status === 'new' && i.severity === 'high'
              return (
                <tr
                  key={i.id}
                  className={`row-${i.severity}${needsAttention ? ' row-attention' : ''}`}
                  onClick={() => navigate(`/incident/${i.id}`)}
                >
                  <td className="rank">{index + 1}</td>
                  <td><Chip tone={i.severity} filled>{i.severity}</Chip></td>
                  <td className="mono"><Link to={`/incident/${i.id}`}>{i.id}</Link></td>
                  <td>
                    <Chip tone={i.response.status === 'new' ? 'new' : 'neutral'}>{statusLabel(i.response.status)}</Chip>
                    {i.response.acknowledgedBy && <div className="sub">{i.response.acknowledgedBy}</div>}
                  </td>
                  <td>
                    {i.callState === 'active' ? (
                      <span className="live"><span className="live-dot" />Live</span>
                    ) : (
                      <span className="muted-inline">Ended</span>
                    )}
                    <div className="sub">{i.channel === 'live-call' ? 'Voice call' : 'Silent tap'}</div>
                  </td>
                  <td>{f.peopleCount ?? '—'}</td>
                  <td>
                    {f.dangerIndicators.length
                      ? f.dangerIndicators.map((d) => <Chip key={d} tone="danger">{d}</Chip>)
                      : <span className="muted-inline">None reported</span>}
                  </td>
                  <td><StressMeter score={i.voiceStressScore} /></td>
                  <td>
                    {i.location.confirmed ? (
                      i.location.confirmed.address
                    ) : (
                      <>
                        ≈ {i.location.rough.lat.toFixed(3)}, {i.location.rough.lng.toFixed(3)}
                        <div className="sub">Approximate ({i.location.rough.source === 'gps' ? 'GPS' : 'IP'})</div>
                      </>
                    )}
                  </td>
                  <td className="mono">{formatElapsed(i.sessionStartedAt, now)}</td>
                  <td title={formatTime(i.sessionStartedAt)}>{timeAgo(i.sessionStartedAt, now)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
