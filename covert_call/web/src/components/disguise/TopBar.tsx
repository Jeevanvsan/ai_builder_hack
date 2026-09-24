import { DELIVERY_ADDRESS } from '../../data/menu'
import { ChevronDownIcon, HeartIcon, PinIcon, UserIcon } from './icons'

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <span className="brand-dot" />
          QuickBite
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Favourites">
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
