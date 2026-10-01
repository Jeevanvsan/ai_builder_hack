import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// The Android build. Drive's direct-download endpoint (not the Drive page): it answers with Content-Disposition:
// attachment, so the click downloads the APK and the visitor stays on this page. Firebase's free plan won't host .apk.
export const APK_URL = 'https://drive.usercontent.google.com/download?id=1sSKiKmJgq_t9nvqdemRnfLvcxnjxQSqz&export=download&confirm=t'

export const LINKS = {
  web: 'https://quickbite-5cde0.web.app',
  github: 'https://github.com/Jeevanvsan/ai_builder_hack',
}

/** Fades + lifts children in when they scroll into view. */
export function Reveal({ children, delay = 0, x = 0, y = 30 }: { children: ReactNode; delay?: number; x?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function Modal({ open, onClose, wide, children }: { open: boolean; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className={`modal${wide ? ' wide' : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** A screenshot from /shots; falls back to the given mock UI until the real image is dropped in. */
export function Shot({ name, alt, fallback }: { name: string; alt: string; fallback: ReactNode }) {
  // Remember which image failed, so reusing this component for another shot (e.g. in the lightbox) retries.
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === name || !__SHOTS__.includes(name)) return <>{fallback}</>
  return <img key={name} className="shot-img" src={`/shots/${name}.png?v=${__BUILD_ID__}`} alt={alt} onError={() => setFailed(name)} />
}

export function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i /><span>{url}</span></div>
      {children}
    </div>
  )
}

export function Phone({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="phone" style={style}>
      <div className="phone-notch" />
      <div className="phone-screen">{children}</div>
    </div>
  )
}

export function QuickBiteScreen({ variant = 'home' }: { variant?: 'home' | 'item' | 'checkout' }) {
  if (variant === 'item') {
    return (
      <div className="qb">
        <div className="qb-thumb" style={{ width: '100%', height: 150, fontSize: 70, borderRadius: 18, marginBottom: 14 }}>🍕</div>
        <b style={{ fontSize: 17 }}>Farmhouse Pizza</b>
        <p style={{ color: '#777', margin: '6px 0 14px' }}>Capsicum, onion, mushroom, sweet corn</p>
        {['Regular', 'Medium', 'Large'].map((s, i) => (
          <div key={s} className="qb-item"><span>{s}</span><span style={{ marginLeft: 'auto', color: i === 1 ? '#e23744' : '#999' }}>{i === 1 ? '●' : '○'}</span></div>
        ))}
        <div style={{ marginTop: 18, background: '#e23744', color: '#fff', textAlign: 'center', padding: 12, borderRadius: 12, fontWeight: 700 }}>Add to cart · ₹349</div>
      </div>
    )
  }
  if (variant === 'checkout') {
    return (
      <div className="qb">
        <b style={{ fontSize: 17 }}>Checkout</b>
        <div className="qb-search" style={{ marginTop: 12, color: '#333' }}>📍 Deliver to: Home</div>
        {[['🍕', 'Farmhouse Pizza', '₹349'], ['🥤', 'Cold Coffee', '₹129'], ['🍟', 'Peri Peri Fries', '₹149']].map(([e, n, p]) => (
          <div key={n} className="qb-item"><div className="qb-thumb">{e}</div><div><b>{n}</b>×1</div><span style={{ marginLeft: 'auto', fontWeight: 700 }}>{p}</span></div>
        ))}
        <div className="qb-item"><b>Total</b><b style={{ marginLeft: 'auto' }}>₹627</b></div>
        <div style={{ marginTop: 18, background: '#e23744', color: '#fff', textAlign: 'center', padding: 12, borderRadius: 12, fontWeight: 700 }}>Place order</div>
        <p style={{ textAlign: 'center', color: '#999', fontSize: 11 }}>Pay on delivery</p>
      </div>
    )
  }
  return (
    <div className="qb">
      <div className="qb-top"><span className="qb-brand">QuickBite</span><span>🛒</span></div>
      <div className="qb-search">🔍 Search pizza, biryani…</div>
      <div className="qb-banner"><b>50% OFF</b>on your first order</div>
      <div className="qb-cats">{['🍕', '🍔', '🍜', '🍰'].map((c) => <div key={c} className="qb-cat">{c}</div>)}</div>
      {[['🍕', 'Farmhouse Pizza', '₹349'], ['🍛', 'Chicken Biryani', '₹289'], ['🍔', 'Classic Burger', '₹199']].map(([e, n, p]) => (
        <div key={n} className="qb-item"><div className="qb-thumb">{e}</div><div><b>{n}</b>{p}</div><span className="qb-add">ADD</span></div>
      ))}
      <div style={{ marginTop: 12, background: '#e23744', color: '#fff', textAlign: 'center', padding: 10, borderRadius: 12, fontWeight: 700 }}>📞 Call to order</div>
    </div>
  )
}

/** Dot indicator for a horizontal swipe row (mobile only; hidden by CSS on wider screens). */
export function SwipeDots({ target, dark }: { target: string; dark?: boolean }) {
  const [count, setCount] = useState(0)
  const [active, setActive] = useState(0)
  const elRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    elRef.current = el
    const update = () => {
      // One dot per swipe position: cards stacked in the same column (the 2-row grid) share a dot.
      const kids = ([...el.children] as HTMLElement[]).filter((k, i, all) => all.findIndex((o) => o.offsetLeft === k.offsetLeft) === i)
      setCount(kids.length)
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0, bestD = Infinity
      kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = i } })
      setActive(best)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [target])
  const go = (i: number) => {
    const el = elRef.current
    const k = el && ([...el.children] as HTMLElement[]).filter((c, n, all) => all.findIndex((o) => o.offsetLeft === c.offsetLeft) === n)[i]
    if (el && k) el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2, behavior: 'smooth' })
  }
  if (count < 2) return null
  return (
    <div className={`swipe-dots${dark ? ' dark' : ''}`}>
      {Array.from({ length: count }, (_, i) => <button key={i} className={i === active ? 'on' : ''} onClick={() => go(i)} aria-label={`Show item ${i + 1}`} />)}
    </div>
  )
}
