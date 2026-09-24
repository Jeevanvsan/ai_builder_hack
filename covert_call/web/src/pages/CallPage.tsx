import { Link, Navigate } from 'react-router-dom'
import { MicOffIcon, PhoneIcon, SpeakerIcon } from '../components/disguise/icons'
import { useCart } from '../state/cart'

export function CallPage() {
  const cart = useCart()
  if (cart.count > 0) return <Navigate to="/cart" replace />

  return (
    <div className="page call-page">
      <div className="call-top">
        <div className="call-avatar" aria-hidden="true">
          QB
        </div>
        <h1>QuickBite Order Desk</h1>
        <p className="call-status">Connecting…</p>
      </div>
      <div className="call-controls">
        <button type="button" className="call-btn" aria-label="Mute">
          <MicOffIcon size={22} />
        </button>
        <Link to="/" className="call-btn end" aria-label="End call">
          <PhoneIcon size={24} />
        </Link>
        <button type="button" className="call-btn" aria-label="Speaker">
          <SpeakerIcon size={22} />
        </button>
      </div>
    </div>
  )
}
