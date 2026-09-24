import { Link } from 'react-router-dom'
import DataState from '../../components/DataState'
import { useIncidents } from '../../lib/incidentsStore'
import { formatTime } from '../../lib/format'

export default function HistoryPage() {
  const { data, loading, error } = useIncidents()
  const resolved = data
    .filter((i) => i.response.status === 'resolved')
    .sort((a, b) => Date.parse(b.response.resolvedAt ?? '') - Date.parse(a.response.resolvedAt ?? ''))

  return (
    <section>
      <div className="page-head">
        <h1>Case history</h1>
        <p className="muted">Filtering arrives in Story 4.5.</p>
      </div>
      <DataState loading={loading} error={error} />
      {!loading && !error && (
      <table className="table">
        <thead>
          <tr>
            <th>Incident</th>
            <th>Started</th>
            <th>Resolved</th>
            <th>Handled by</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {resolved.map((i) => (
            <tr key={i.id}>
              <td><Link to={`/incident/${i.id}`}>{i.id}</Link></td>
              <td>{formatTime(i.sessionStartedAt)}</td>
              <td>{i.response.resolvedAt ? formatTime(i.response.resolvedAt) : '—'}</td>
              <td>{i.response.acknowledgedBy ?? '—'}</td>
              <td>{i.location.confirmed?.address ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </section>
  )
}
