import { Link, useNavigate } from 'react-router-dom'
import Chip from '../../components/Chip'
import StressMeter from '../../components/StressMeter'
import DataState from '../../components/DataState'
import Pagination from '../../components/Pagination'
import { useIncidents } from '../../lib/incidentsStore'
import { isUnviewed, rankOpenIncidents } from '../../lib/ranking'
import { usePagination } from '../../lib/usePagination'
import { channelLabel, formatElapsed, formatTime, statusLabel, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/useNow'

export default function QueuePage() {
  const now = useNow()
  const navigate = useNavigate()
  const { data, loading, error } = useIncidents('open')
  const queue = rankOpenIncidents(data)
  const pager = usePagination(queue)

  const stats = [
    { label: 'Not yet opened', value: queue.filter(isUnviewed).length, tone: 'new' },
    { label: 'Open incidents', value: queue.length },
    { label: 'High severity', value: queue.filter((i) => i.severity === 'high').length, tone: 'high' },
    { label: 'Unclaimed', value: queue.filter((i) => i.response.status === 'new').length, tone: 'medium' },
    { label: 'Live calls', value: queue.filter((i) => i.callState === 'active').length, tone: 'live' },
  ]

  return (
    <section>
      <div className="page-head">
        <h1>Live queue</h1>
        <p className="muted">New incidents stay highlighted at the top until a responder opens them. The rest are ranked by severity, then unclaimed, then live calls, then longest waiting.</p>
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
        <>
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
            {pager.pageItems.map((i, index) => {
              const f = i.extractedFieldsLive
              const unviewed = isUnviewed(i)
              return (
                <tr
                  key={i.id}
                  className={`row-${i.severity}${unviewed ? ' row-new' : ''}`}
                  onClick={() => navigate(`/incident/${i.id}`)}
                >
                  <td className="rank">{pager.offset + index + 1}</td>
                  <td><Chip tone={i.severity} filled>{i.severity}</Chip></td>
                  <td className="mono">
                    <Link to={`/incident/${i.id}`}>{i.id}</Link>
                    {unviewed && <div><Chip tone="new" filled>New</Chip></div>}
                  </td>
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
                    <div className="sub">{channelLabel(i.channel)}</div>
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
                    ) : i.location.rough ? (
                      <>
                        ≈ {i.location.rough.lat.toFixed(3)}, {i.location.rough.lng.toFixed(3)}
                        <div className="sub">Approximate ({i.location.rough.source === 'gps' ? 'GPS' : 'IP'})</div>
                      </>
                    ) : (
                      <span className="muted-inline">Locating…</span>
                    )}
                  </td>
                  <td className="mono">{formatElapsed(i.sessionStartedAt, now)}</td>
                  <td title={formatTime(i.sessionStartedAt)}>{timeAgo(i.sessionStartedAt, now)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination {...pager} noun="open incidents" onPage={pager.setPage} />
        </>
      )}
    </section>
  )
}
