import { useEffect, useState } from 'react'
import { nearbyServices, suggestedServiceKind, type NearbyService, type ServiceKind } from '../lib/nearbyServices'

const KIND_LABEL: Record<ServiceKind, string> = { police: 'Police', fire: 'Fire', hospital: 'Hospital' }

// Epic 16.6: once a location is confirmed, fetched on demand (like CallRecordingPlayer) rather than via the live
// incident listener, since it's a one-off lookup keyed off coordinates, not something that changes with the call.
export default function NearbyServicesCard({
  location,
  dangerIndicators,
}: {
  location: { lat: number; lng: number }
  dangerIndicators: string[]
}) {
  const [services, setServices] = useState<NearbyService[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    nearbyServices(location)
      .then((results) => !cancelled && setServices(results))
      .catch(() => !cancelled && setError(true))
    return () => { cancelled = true }
  }, [location])

  const suggested = suggestedServiceKind(dangerIndicators)

  return (
    <div className="card nearby-card">
      <h2>Nearby services</h2>
      {error && <p className="muted">Couldn't load nearby services.</p>}
      {!error && !services && <p className="muted">Looking up nearby police, fire and hospital…</p>}
      {services && services.length === 0 && <p className="muted">No nearby services found within 5km.</p>}
      {services && services.length > 0 && (
        <ul className="nearby-list">
          {services.map((s) => (
            <li key={`${s.kind}-${s.name}-${s.lat}`} className={s.kind === suggested ? 'nearby-suggested' : undefined}>
              <span className={`nearby-kind nearby-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
              <span className="nearby-name">{s.name}</span>
              <span className="sub">{s.distanceKm.toFixed(1)} km</span>
              {s.phone ? (
                <a className="btn btn-sm" href={`tel:${s.phone}`}>Call station</a>
              ) : (
                <span className="sub">No number listed</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
