import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '../../data/menu'
import { CODE_BY_ID } from '../../lib/codes'
import { formatRupees, useCart } from '../../state/cart'
import { CloseIcon, StarIcon, VegMark } from './icons'
import { QtyStepper } from './QtyStepper'

export function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const cart = useCart()
  const [qty, setQty] = useState(1)
  // Long-press the image to reveal what a coded item really reports (Epic 8, Story 8.1). Ordinary items have no
  // code, so nothing is ever revealed for them — the disguise is untouched for a normal customer.
  const code = item.code ? CODE_BY_ID[item.code] : undefined
  const [revealed, setRevealed] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPress = () => {
    if (!code) return
    pressTimer.current = setTimeout(() => setRevealed(true), 500)
  }
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }
  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>
        <img
          className="sheet-img"
          src={item.image}
          alt={item.name}
          width={640}
          height={480}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
        />
        {revealed && code && <p className="code-reveal">{code.meaning}</p>}
        <div className="sheet-body">
          <div className="item-tags">
            <VegMark veg={item.veg} />
            {item.bestseller && <span className="bestseller">★ Bestseller</span>}
          </div>
          <h2 className="sheet-title">{item.name}</h2>
          <div className="sheet-meta">
            <span className="item-price">{item.price === 0 ? 'Free' : formatRupees(item.price)}</span>
            {item.rating && (
              <span className="item-rating">
                <StarIcon size={12} /> {item.rating} <span>({item.ratingCount} ratings)</span>
              </span>
            )}
          </div>
          <p className="sheet-desc">{item.description}</p>
        </div>
        <div className="sheet-footer">
          <QtyStepper qty={qty} onInc={() => setQty((q) => q + 1)} onDec={() => setQty((q) => Math.max(1, q - 1))} />
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              cart.add(item.id, qty)
              onClose()
            }}
          >
            Add item · {item.price === 0 ? 'Free' : formatRupees(item.price * qty)}
          </button>
        </div>
      </div>
    </div>
  )
}
