import { Link } from 'react-router-dom'
import { formatRupees, useCart } from '../../state/cart'
import { ChevronRightIcon, PhoneIcon } from './icons'

// Home is the only fork point: calling, silent reporting, and checkout are three separate forks, never a
// sequence — offered only while the cart is empty so none of them can ever belong to the same order.
// "Delivery instructions" is the silent-tap mode's disguise: an ordinary, unremarkable thing to tap on a food app.
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
          <Link to="/delivery-instructions" className="guest-subtle-link">Delivery instructions</Link>
        </span>
        <Link to="/call" className="call-cta">
          <PhoneIcon size={16} /> Call to order
        </Link>
      </div>
    </div>
  )
}
