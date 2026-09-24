import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { DELIVERY_ADDRESS, OUTLET } from '../data/menu'
import { BillDetails } from '../components/disguise/BillDetails'
import { PageHeader } from '../components/disguise/PageHeader'
import { ClockIcon, HomeIcon, WalletIcon } from '../components/disguise/icons'
import { computeBill, formatRupees, useCart } from '../state/cart'

type Payment = 'cod' | 'upi'

const PAYMENT_OPTIONS: { id: Payment; label: string; hint: string }[] = [
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay in cash when your order arrives' },
  { id: 'upi', label: 'UPI on delivery', hint: 'Scan and pay with any UPI app at your door' },
]

export function CheckoutPage() {
  const cart = useCart()
  const [payment, setPayment] = useState<Payment>('cod')

  if (cart.count === 0) return <Navigate to="/" replace />

  const total = computeBill(cart.subtotal).total

  return (
    <div className="page page-sub">
      <PageHeader title="Checkout" subtitle={`${cart.count} item${cart.count > 1 ? 's' : ''} · ${OUTLET.name}`} backTo="/cart" />

      <section className="card">
        <div className="info-row">
          <HomeIcon size={20} className="info-icon" />
          <div className="info-copy">
            <strong>Deliver to {DELIVERY_ADDRESS.label}</strong>
            <span>{DELIVERY_ADDRESS.line}</span>
          </div>
          <button type="button" className="link-btn">
            Change
          </button>
        </div>
        <div className="info-row">
          <ClockIcon size={20} className="info-icon" />
          <div className="info-copy">
            <strong>Delivery in {OUTLET.eta}</strong>
            <span>Standard delivery</span>
          </div>
        </div>
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

      <BillDetails subtotal={cart.subtotal} />

      <div className="bottom-bar">
        <button type="button" className="checkout-bar">
          <span className="cart-bar-summary">
            <strong>{formatRupees(total)}</strong>
            <span>{payment === 'cod' ? 'Cash on delivery' : 'UPI on delivery'}</span>
          </span>
          <span className="cart-bar-cta">Place order</span>
        </button>
      </div>
    </div>
  )
}
