import type { MenuItem } from '../../data/menu'
import { formatRupees, useCart } from '../../state/cart'
import { StarIcon, VegMark } from './icons'
import { QtyStepper } from './QtyStepper'

export function MenuItemCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  const cart = useCart()
  const qty = cart.qtyOf(item.id)

  return (
    <article className="item-card" onClick={() => onOpen(item)}>
      <div className="item-info">
        <div className="item-tags">
          <VegMark veg={item.veg} />
          {item.bestseller && <span className="bestseller">★ Bestseller</span>}
        </div>
        <h3 className="item-name">{item.name}</h3>
        <div className="item-price">{item.price === 0 ? 'Free' : formatRupees(item.price)}</div>
        {item.rating && (
          <div className="item-rating">
            <StarIcon size={12} /> {item.rating} <span>({item.ratingCount})</span>
          </div>
        )}
        <p className="item-desc">{item.description}</p>
      </div>
      <div className="item-media">
        <img src={item.image} alt={item.name} loading="lazy" decoding="async" width={640} height={480} />
        <div className="item-cta">
          {qty > 0 ? (
            <QtyStepper qty={qty} onInc={() => cart.add(item.id)} onDec={() => cart.decrement(item.id)} />
          ) : (
            <button
              type="button"
              className="add-btn"
              onClick={(e) => {
                e.stopPropagation()
                cart.add(item.id)
              }}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
