import { Link, useParams } from 'react-router-dom'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import LiveVideo from '../../components/LiveVideo'
import { formatElapsed } from '../../lib/format'
import { useIncident } from '../../lib/incidentsStore'
import { useNow } from '../../lib/useNow'

// Full-screen view of an incident's camera feed, for the ops-center wall display.
export default function IncidentVideoPage() {
  const { id } = useParams()
  const { data: incident, loading, error } = useIncident(id)
  const now = useNow()

  if (loading || error || !incident) {
    return (
      <section>
        <Link to={id ? `/incident/${id}` : '/'} className="back-link">← Back to incident</Link>
        {loading || error ? <DataState loading={loading} error={error} /> : <p className="muted">No incident with this ID.</p>}
      </section>
    )
  }

  const live = incident.callState === 'active' && incident.response.status !== 'resolved'
  return (
    <section className="video-page">
      <div className="video-page-head">
        <Link to={`/incident/${incident.id}`} className="back-link">← Back to incident</Link>
        <h1>
          <span className="mono">{incident.id}</span>
          <Chip tone={incident.severity} filled>{incident.severity}</Chip>
        </h1>
        <span className="muted-inline">
          {live ? `Call in progress · ${formatElapsed(incident.sessionStartedAt, now)}` : 'Call ended'}
          {incident.location.confirmed && ` · ${incident.location.confirmed.address}`}
        </span>
      </div>
      <LiveVideo incident={incident} large />
    </section>
  )
}
