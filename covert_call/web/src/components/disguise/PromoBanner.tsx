import banner from '../../assets/food/banner.jpg'
import { FREE_DELIVERY_THRESHOLD } from '../../state/cart'
import { OUTLET } from '../../data/menu'
import { ClockIcon, StarIcon } from './icons'

export function PromoBanner() {
  return (
    <section className="promo">
      <div className="promo-card" style={{ backgroundImage: `url(${banner})` }}>
        <span className="promo-badge">TODAY ONLY</span>
        <div className="promo-copy">
          <strong>Free delivery over ₹{FREE_DELIVERY_THRESHOLD}</strong>
          <span>
            Hot &amp; fresh at your door in <b className="nowrap">{OUTLET.eta}</b>
          </span>
        </div>
      </div>
      <div className="outlet">
        <div className="outlet-main">
          <h1 className="outlet-name">{OUTLET.name}</h1>
          <p className="outlet-sub">
            {OUTLET.cuisines} · {OUTLET.area}
          </p>
        </div>
        <div className="outlet-meta">
          <span className="rating-chip">
            <StarIcon size={12} /> {OUTLET.rating}
          </span>
          <span className="outlet-eta">
            <ClockIcon size={13} /> {OUTLET.eta}
          </span>
        </div>
      </div>
    </section>
  )
}
