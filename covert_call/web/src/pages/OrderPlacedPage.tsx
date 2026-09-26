import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { OUTLET } from '../data/menu'
import { db } from '../lib/firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { ResponseStatus } from '../../../shared/incidents/types.ts'
import { CheckIcon } from '../components/disguise/icons'

// The confirmation shown after "Place order" (Epic 8, Story 8.3). Deliberately an ordinary order-tracking screen:
// a coded order and a real order end here identically, so nothing reveals which one just happened.
//
// When it arrived from a coded order, it also mirrors the responder's progress on the incident as ordinary
// delivery status (Epic 8.3): acknowledged -> "Rider assigned", in progress -> "On the way", resolved -> delivered.
export function OrderPlacedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const incidentId = (location.state as { incidentId?: string } | null)?.incidentId ?? null
  const [orderId] = useState(() => `QB${100000 + (Date.now() % 900000)}`)
  const [status, setStatus] = useState<ResponseStatus | null>(null)

  useEffect(() => {
    if (!incidentId) return
    // Read-only subscription (rules allow public read); shows nothing safety-related, only "delivery" progress.
    return onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
      const s = snap.data()?.response?.status as ResponseStatus | undefined
      if (s) setStatus(s)
    })
  }, [incidentId])

  // Map the responder's real status onto believable delivery milestones.
  const stage = status === 'resolved' ? 3 : status === 'in_progress' ? 2 : status === 'acknowledged' ? 1 : 0
  const steps = [
    { label: 'Order confirmed' },
    { label: 'Rider assigned' },
    { label: 'On the way' },
    { label: 'Delivered' },
  ]

  return (
    <div className="page page-sub order-placed">
      <div className="order-hero">
        <div className="order-check" aria-hidden="true">
          <CheckIcon size={34} />
        </div>
        <h1>Order placed!</h1>
        <p className="muted">Thanks for ordering from {OUTLET.name}.</p>
      </div>

      <section className="card">
        <div className="order-meta">
          <div>
            <span className="order-meta-label">Order ID</span>
            <strong className="mono">{orderId}</strong>
          </div>
          <div>
            <span className="order-meta-label">Estimated arrival</span>
            <strong>{OUTLET.eta}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Order status</h2>
        <ol className="order-steps">
          {steps.map((s, idx) => (
            <li key={s.label} className={idx <= stage ? 'is-done' : ''}>
              <span className="order-step-dot" aria-hidden="true">{idx <= stage ? '✓' : ''}</span>
              <span>{s.label}</span>
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
