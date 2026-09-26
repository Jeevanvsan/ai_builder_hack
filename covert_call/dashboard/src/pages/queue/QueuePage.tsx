import { motion } from 'motion/react'
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

// Epic: live queue as a card feed, not a table — severity/live/new state read visually (color, size, position)
// at a glance, matching how a responder actually scans a live board rather than reading table cells row by row.
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
          <div className="incident-feed">
            {pager.pageItems.map((i, index) => {
              const f = i.extractedFieldsLive
              const unviewed = isUnviewed(i)
              return (
                <motion.div
                  key={i.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index, 5) * 0.03 }}
                  className={`incident-card incident-card-${i.severity}${unviewed ? ' incident-card-new' : ''}`}
                  onClick={() => navigate(`/incident/${i.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/incident/${i.id}`)}
                >
                  <div className="incident-card-head">
                    <span className="incident-card-rank">#{pager.offset + index + 1}</span>
                    <Chip tone={i.severity} filled>{i.severity}</Chip>
                    {unviewed && <Chip tone="new" filled>New</Chip>}
                    {i.callState === 'active' ? (
                      <span className="live"><span className="live-dot" />Live</span>
                    ) : (
                      <span className="muted-inline">Ended</span>
                    )}
                  </div>

                  <Link to={`/incident/${i.id}`} className="incident-card-id mono" onClick={(e) => e.stopPropagation()}>
                    {i.id}
                  </Link>
                  <div className="sub">
                    {channelLabel(i.channel)}
                    {i.incidentType === 'sos' && (
                      <span className="sos-badge">SOS{i.scenario ? ` · ${i.scenario}` : ''}</span>
                    )}
                  </div>

                  <div className="incident-card-body">
                    <div className="incident-card-field">
                      <span className="incident-card-label">People</span>
                      <span>{f.peopleCount ?? '—'}</span>
                    </div>
                    <div className="incident-card-field">
                      <span className="incident-card-label">Status</span>
                      <Chip tone={i.response.status === 'new' ? 'new' : 'neutral'}>{statusLabel(i.response.status)}</Chip>
                    </div>
                    <div className="incident-card-field">
                      <span className="incident-card-label">Voice stress</span>
                      <StressMeter score={i.voiceStressScore} />
                    </div>
                  </div>

                  {f.dangerIndicators.length > 0 && (
                    <div className="incident-card-indicators">
                      {f.dangerIndicators.slice(0, 3).map((d) => <Chip key={d} tone="danger">{d}</Chip>)}
                      {f.dangerIndicators.length > 3 && <span className="sub">+{f.dangerIndicators.length - 3} more</span>}
                    </div>
                  )}

                  <div className="incident-card-location sub">
                    {i.location.confirmed ? (
                      i.location.confirmed.address
                    ) : i.location.rough ? (
                      `≈ ${i.location.rough.lat.toFixed(3)}, ${i.location.rough.lng.toFixed(3)} (${i.location.rough.source === 'gps' ? 'GPS' : 'IP'})`
                    ) : (
                      'Locating…'
                    )}
                  </div>

                  <div className="incident-card-foot sub">
                    <span className="mono">{formatElapsed(i.sessionStartedAt, now)} elapsed</span>
                    <span title={formatTime(i.sessionStartedAt)}>{timeAgo(i.sessionStartedAt, now)}</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
          <Pagination {...pager} noun="open incidents" onPage={pager.setPage} />
        </>
      )}
    </section>
  )
}
