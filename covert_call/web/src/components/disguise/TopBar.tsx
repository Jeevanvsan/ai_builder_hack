import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DELIVERY_ADDRESS } from '../../data/menu'
import { APP_NAME } from '../../lib/brand'
import { ChevronDownIcon, HeartIcon, PinIcon, UserIcon } from './icons'

export function TopBar() {
  const navigate = useNavigate()
  // Double-tapping the heart is the hidden trigger for the silent SOS (Epic 11.1). A single tap does nothing
  // unusual, so the heart behaves like an ordinary favourites button to anyone watching.
  const lastTapRef = useRef(0)
  const onHeartTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 400) {
      lastTapRef.current = 0
      navigate('/sos')
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <span className="brand-dot" />
          {APP_NAME}
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Favourites" onClick={onHeartTap}>
            <HeartIcon size={19} />
          </button>
          <button type="button" className="icon-btn avatar" aria-label="Account">
            <UserIcon size={18} />
          </button>
        </div>
      </div>
      <button type="button" className="address-pill">
        <PinIcon size={16} className="address-pin" />
        <span className="address-label">{DELIVERY_ADDRESS.label}</span>
        <span className="address-line">{DELIVERY_ADDRESS.line}</span>
        <ChevronDownIcon size={16} className="address-caret" />
      </button>
    </header>
  )
}
