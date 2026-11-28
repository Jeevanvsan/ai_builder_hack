import type { Service } from '../../data/services'
import { ClockIcon, StarIcon } from './icons'

// The open service's banner and outlet (QuickOne, Epic 33). Food shows the original QuickBite banner and wording.
export function PromoBanner({ service }: { service: Service }) {
  const { outlet, promo } = service
  return (
    <section className="promo">
      <div className="promo-card" style={{ backgroundImage: `url(${service.banner})` }}>
        <span className="promo-badge">{promo.badge}</span>
        <div className="promo-copy">
          <strong>{promo.title}</strong>
          <span>
            {promo.line} <b className="nowrap">{outlet.eta}</b>
          </span>
        </div>
      </div>
      <div className="outlet">
        <div className="outlet-main">
          <h1 className="outlet-name">{outlet.name}</h1>
          <p className="outlet-sub">
            {outlet.tagline} · {outlet.area}
          </p>
        </div>
        <div className="outlet-meta">
          <span className="rating-chip">
            <StarIcon size={12} /> {outlet.rating}
          </span>
          <span className="outlet-eta">
            <ClockIcon size={13} /> {outlet.eta}
          </span>
        </div>
      </div>
    </section>
  )
}
