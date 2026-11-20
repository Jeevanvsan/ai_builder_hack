import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { SERVICES, isServiceId } from '../data/services'
import { APP_INITIALS } from '../lib/brand'
import { db } from '../lib/firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import { startLocationTrail } from '../../../shared/incidents/trail.ts'
import type { ResponseStatus } from '../../../shared/incidents/types.ts'
import { gpsSimEnabled } from '../lib/gpsSim'
import { CheckIcon } from '../components/disguise/icons'

// The confirmation shown after "Place order" (Epic 8, Story 8.3). Deliberately an ordinary order-tracking screen:
// a coded order and a real order end here identically, so nothing reveals which one just happened.
//
// When it arrived from a coded order, it also mirrors the responder's progress on the incident as ordinary
// delivery status (Epic 8.3): acknowledged -> "Rider assigned", in progress -> "On the way", resolved -> delivered.
// QuickOne (Epic 33): worded for the order's service (a home repair says "Technician assigned", "Job done").
export function OrderPlacedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { incidentId?: string; service?: string } | null
  const incidentId = state?.incidentId ?? null
  const service = SERVICES[isServiceId(state?.service) ? state.service : 'food']
  const [orderId] = useState(() => `${APP_INITIALS}${100000 + (Date.now() % 900000)}`)
  const [status, setStatus] = useState<ResponseStatus | null>(null)

  useEffect(() => {
    if (!incidentId) return
    // Read-only subscription (rules allow public read); shows nothing safety-related, only "delivery" progress.
    return onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
      const s = snap.data()?.response?.status as ResponseStatus | undefined
      if (s) setStatus(s)
    })
  }, [incidentId])

  // After a coded order, keep sending the caller's position while this screen is open (like a delivery app
  // tracking the drop-off point), so responders can follow them if they move. A real order has no incident.
  useEffect(() => {
    if (!incidentId) return
    const trail = startLocationTrail(db, incidentId, { source: gpsSimEnabled ? 'sim' : 'gps' })
    return () => trail.stop()
  }, [incidentId])

  // Map the responder's real status onto believable delivery milestones.
  const stage = status === 'resolved' ? 3 : status === 'in_progress' ? 2 : status === 'acknowledged' ? 1 : 0

  return (
    <div className="page page-sub order-placed">
      <div className="order-hero">
        <div className="order-check" aria-hidden="true">
          <CheckIcon size={34} />
        </div>
        <h1>{service.placed}</h1>
        <p className="muted">{service.thanks} {service.outlet.name}.</p>
      </div>

      <section className="card">
        <div className="order-meta">
          <div>
            <span className="order-meta-label">Order ID</span>
            <strong className="mono">{orderId}</strong>
          </div>
          <div>
            <span className="order-meta-label">Estimated arrival</span>
            <strong>{service.outlet.eta}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Order status</h2>
        <ol className="order-steps">
          {service.steps.map((label, idx) => (
            <li key={label} className={idx <= stage ? 'is-done' : ''}>
              <span className="order-step-dot" aria-hidden="true">{idx <= stage ? '✓' : ''}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="bottom-bar">
        <button type="button" className="checkout-bar" onClick={() => navigate('/', { replace: true })}>
          <span className="cart-bar-cta">Back to home</span>
        </button>
      </div>
    </div>
  )
}
