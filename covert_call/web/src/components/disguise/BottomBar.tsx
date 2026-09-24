import { Link } from 'react-router-dom'
import { formatRupees, useCart } from '../../state/cart'
import { ChevronRightIcon, PhoneIcon } from './icons'

// Home is the only fork point: calling is offered only while the cart is empty,
// so the checkout path and the call path can never belong to the same order.
export function BottomBar() {
  const cart = useCart()

  if (cart.count > 0) {
    return (
      <div className="bottom-bar">
        <Link to="/cart" className="cart-bar">
          <span className="cart-bar-summary">
            <strong>
              {cart.count} item{cart.count > 1 ? 's' : ''}
            </strong>
            <span>{formatRupees(cart.subtotal)} plus taxes</span>
          </span>
          <span className="cart-bar-cta">
            View cart <ChevronRightIcon size={18} />
          </span>
        </Link>
      </div>
    )
  }

  return (
    <div className="bottom-bar">
      <div className="guest-bar">
        <span className="guest-copy">
          <strong>Ordering as guest</strong>
          <span>Prefer to order by phone?</span>
        </span>
        <Link to="/call" className="call-cta">
          <PhoneIcon size={16} /> Call to order
        </Link>
      </div>
    </div>
  )
}
