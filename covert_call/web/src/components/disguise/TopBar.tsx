import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DELIVERY_ADDRESS } from '../../data/menu'
import { APP_NAME } from '../../lib/brand'
import { DEMO_LONG_PRESS_MS } from '../../lib/demo'
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

  // Long-pressing the logo is the hidden trigger for a demo call (Epic 25), which never reaches the dashboard.
  // A short press does nothing, so the logo looks like any ordinary brand mark.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPress = () => {
    pressTimerRef.current = setTimeout(() => navigate('/call?demo=1'), DEMO_LONG_PRESS_MS)
  }
  const cancelPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
  }

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div
          className="brand"
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
        >
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
