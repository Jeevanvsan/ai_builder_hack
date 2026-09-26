import { Link } from 'react-router-dom'

// Epic 19.1: links to other incidents that appear to describe the same person/vehicle/location — found by
// comparing our own recent reports, never an external lookup.
export default function CorrelatedIncidentsCard({ incidentIds }: { incidentIds: string[] }) {
  if (!incidentIds.length) return null
  return (
    <div className="card correlated-card">
      <h2>Possibly related</h2>
      <p className="sub">These incidents appear to describe the same person, vehicle, or location.</p>
      <ul className="correlated-list">
        {incidentIds.map((id) => (
          <li key={id}>
            <Link to={`/incident/${id}`} className="btn btn-sm">{id}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
