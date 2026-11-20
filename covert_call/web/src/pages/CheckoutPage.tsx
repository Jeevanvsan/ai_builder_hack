import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { DELIVERY_ADDRESS, serviceOf } from '../data/menu'
import { cartService } from '../data/services'
import { APP_NAME } from '../lib/brand'
import { BillDetails } from '../components/disguise/BillDetails'
import { PageHeader } from '../components/disguise/PageHeader'
import { ClockIcon, HomeIcon, WalletIcon } from '../components/disguise/icons'
import { computeBill, formatRupees, useCart } from '../state/cart'
import { db } from '../lib/firebase'
import { decodeOrder } from '../../../shared/codes'
import { startIncident, updateLiveFields } from '../../../shared/incidents/client.ts'
import type { Severity } from '../../../shared/incidents/types.ts'

type Payment = 'cod' | 'upi'

const PAYMENT_OPTIONS: { id: Payment; label: string; hint: string }[] = [
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay in cash when your order arrives' },
  { id: 'upi', label: 'UPI on delivery', hint: 'Scan and pay with any UPI app at your door' },
]

export function CheckoutPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<Payment>('cod')
  const [deliveryUrgency, setDeliveryUrgency] = useState<Severity>('low')
  const [placing, setPlacing] = useState(false)
  // QuickOne (Epic 33): wording and speed options follow the service the cart's items come from.
  const { service, mixed } = cartService(cart.lines)
  const outletName = mixed ? APP_NAME : service.outlet.name

  // placeOrder() clears the cart right after navigating to /order-placed. React Router runs that navigation as a
  // transition, so the cleared cart renders first: redirecting home here would replace the order-placed screen.
  // Native's checkout has the same !placing guard.
  if (cart.count === 0) return placing ? null : <Navigate to="/" replace />

  const total = computeBill(cart.subtotal).total

  // Placing the order: a normal order just clears the cart and shows confirmation. If the cart carries any coded
  // items, it silently raises a decoded incident first — nothing on screen differs between the two, so a normal
  // customer and a person in danger see the identical "order placed" flow.
  const placeOrder = async () => {
    if (placing) return
    setPlacing(true)
    // A coded grocery/pharmacy/home item is named by its own label in the notes; food keeps the menu label.
    const codedLines = cart.lines
      .filter((l) => l.item.code)
      .map((l) => ({ codeId: l.item.code as string, qty: l.qty, label: serviceOf(l.item) === 'food' ? undefined : l.item.name }))

    let incidentId: string | null = null
    if (codedLines.length > 0) {
      try {
        const decoded = decodeOrder(codedLines, deliveryUrgency)
        const { id } = await startIncident(db, { channel: 'click-order' })
        incidentId = id
        await updateLiveFields(db, id, {
          dangerIndicators: decoded.dangerIndicators,
          peopleCount: decoded.peopleCount,
          urgency: decoded.urgency,
          notes: decoded.notes,
        })
      } catch {
        // Best-effort: never let a failed write leave the person stuck on a checkout screen that won't complete —
        // the order-placed screen must always appear so the disguise holds.
      }
    }

    // Pass the incident id so the order-tracking screen can mirror the responder's progress in disguise (Epic 8.3),
    // and the service so it is worded for it.
    navigate('/order-placed', { replace: true, state: { ...(incidentId ? { incidentId } : {}), service: service.id } })
    cart.clear()
  }

  return (
    <div className="page page-sub">
      <PageHeader title="Checkout" subtitle={`${cart.count} item${cart.count > 1 ? 's' : ''} · ${outletName}`} backTo="/cart" />

      <section className="card">
        <div className="info-row">
          <HomeIcon size={20} className="info-icon" />
          <div className="info-copy">
            <strong>{service.addressTitle} {DELIVERY_ADDRESS.label}</strong>
            <span>{DELIVERY_ADDRESS.line}</span>
          </div>
          <button type="button" className="link-btn">
            Change
          </button>
        </div>
        <div className="info-row">
          <ClockIcon size={20} className="info-icon" />
          <div className="info-copy">
            <strong>{service.etaLabel} {service.outlet.eta}</strong>
            <span>{service.etaSub}</span>
          </div>
        </div>
      </section>

      {/* The speed choice doubles as the urgency signal for a coded "click & order" (Epic 8, Story 8.2): an
          ordinary-looking "how soon do you want it" maps straight to how urgently a responder should act. */}
      <section className="card">
        <h2 className="card-title">{service.speedTitle}</h2>
        {service.speeds.map((d) => (
          <label key={d.id} className={`pay-option ${deliveryUrgency === d.id ? 'is-selected' : ''}`}>
            <ClockIcon size={20} className="info-icon" />
            <span className="info-copy">
              <strong>{d.label}</strong>
              <span>{d.hint}</span>
            </span>
            <input type="radio" name="delivery" checked={deliveryUrgency === d.id} onChange={() => setDeliveryUrgency(d.id)} />
          </label>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">Payment method</h2>
        {PAYMENT_OPTIONS.map((p) => (
          <label key={p.id} className={`pay-option ${payment === p.id ? 'is-selected' : ''}`}>
            <WalletIcon size={20} className="info-icon" />
            <span className="info-copy">
              <strong>{p.label}</strong>
              <span>{p.hint}</span>
            </span>
            <input type="radio" name="payment" checked={payment === p.id} onChange={() => setPayment(p.id)} />
          </label>
        ))}
      </section>

      <BillDetails subtotal={cart.subtotal} service={service} />

      <div className="bottom-bar">
        <button type="button" className="checkout-bar" disabled={placing} onClick={() => void placeOrder()}>
          <span className="cart-bar-summary">
            <strong>{formatRupees(total)}</strong>
            <span>{payment === 'cod' ? 'Cash on delivery' : 'UPI on delivery'}</span>
          </span>
          <span className="cart-bar-cta">{placing ? service.placingCta : service.placeCta}</span>
        </button>
      </div>
    </div>
  )
}
