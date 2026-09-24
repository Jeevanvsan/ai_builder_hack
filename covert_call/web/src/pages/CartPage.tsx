import { Link } from 'react-router-dom'
import { OUTLET } from '../data/menu'
import { BillDetails } from '../components/disguise/BillDetails'
import { PageHeader } from '../components/disguise/PageHeader'
import { QtyStepper } from '../components/disguise/QtyStepper'
import { VegMark } from '../components/disguise/icons'
import { computeBill, formatRupees, useCart } from '../state/cart'

export function CartPage() {
  const cart = useCart()

  if (cart.count === 0) {
    return (
      <div className="page page-sub">
        <PageHeader title="Cart" backTo="/" />
        <div className="empty-cart">
          <div className="empty-cart-art" aria-hidden="true">
            🛒
          </div>
          <h2>Your cart is empty</h2>
          <p>Good food is always cooking. Go ahead, order some yummy items from the menu.</p>
          <Link to="/" className="primary-btn">
            Browse menu
          </Link>
        </div>
      </div>
    )
  }

  const total = computeBill(cart.subtotal).total

  return (
    <div className="page page-sub">
      <PageHeader title={OUTLET.name} subtitle={`${OUTLET.area} · ${OUTLET.eta}`} backTo="/" />

      <section className="card cart-lines">
        {cart.lines.map(({ item, qty }) => (
          <div key={item.id} className="cart-line">
            <VegMark veg={item.veg} />
            <div className="cart-line-name">
              <span>{item.name}</span>
              <small>{item.price === 0 ? 'Free' : formatRupees(item.price)}</small>
            </div>
            <QtyStepper size="sm" qty={qty} onInc={() => cart.add(item.id)} onDec={() => cart.decrement(item.id)} />
            <span className="cart-line-price">{item.price === 0 ? 'Free' : formatRupees(item.price * qty)}</span>
          </div>
        ))}
        <Link to="/" className="add-more">
          + Add more items
        </Link>
      </section>

      <BillDetails subtotal={cart.subtotal} />

      <p className="policy-note">
        Review your order and address details to avoid cancellations. Orders cannot be cancelled once packed for delivery.
      </p>

      <div className="bottom-bar">
        <Link to="/checkout" className="checkout-bar">
          <span className="cart-bar-summary">
            <strong>{formatRupees(total)}</strong>
            <span>Total</span>
          </span>
          <span className="cart-bar-cta">Proceed to checkout</span>
        </Link>
      </div>
    </div>
  )
}
