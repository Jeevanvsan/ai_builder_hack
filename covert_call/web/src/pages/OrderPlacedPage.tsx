import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OUTLET } from '../data/menu'
import { CheckIcon } from '../components/disguise/icons'

// The confirmation shown after "Place order" (Epic 8, Story 8.3). Deliberately an ordinary order-tracking
// screen: a coded order and a real order end here identically, so nothing reveals which one just happened.
export function OrderPlacedPage() {
  const navigate = useNavigate()
  // A believable, stable order number derived once from the current time (lazy initializer, so it doesn't change
  // on re-render). Kept cosmetic — nothing depends on its value.
  const [orderId] = useState(() => `QB${100000 + (Date.now() % 900000)}`)

  const steps = [
    { label: 'Order confirmed', done: true },
    { label: 'Kitchen is preparing your food', done: false },
    { label: 'Out for delivery', done: false },
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
          {steps.map((s) => (
            <li key={s.label} className={s.done ? 'is-done' : ''}>
              <span className="order-step-dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
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
