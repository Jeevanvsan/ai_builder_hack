import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Modal, Reveal } from './ui'

// Real screenshots of the QuickBite app and the responder dashboard (public/shots), grouped by area. Tap one to
// see it full size.
type Area = 'app' | 'dashboard' | 'analytics'
const SHOTS: { name: string; area: Area; title: string; caption: string; phone?: boolean }[] = [
  { name: 'qb-home', area: 'app', phone: true, title: 'The disguise', caption: 'An ordinary food-delivery menu. "Call to order" starts the covert call.' },
  { name: 'qb-item', area: 'app', phone: true, title: 'A coded menu item', caption: 'Long-press reveals the real meaning: Extra Pepperoni = someone near you has a weapon.' },
  { name: 'queue', area: 'dashboard', title: 'Live queue', caption: 'Every incident ranked by severity, with danger tags, voice stress and location.' },
  { name: 'search', area: 'dashboard', title: 'Ask AI search', caption: 'Describe a situation in plain words; AI finds the matching open incidents.' },
  { name: 'responder', area: 'dashboard', title: 'Live incident board', caption: 'Threat, vehicle, subjects, voice stress, nearby help and linked cases around the live map.' },
  { name: 'route', area: 'dashboard', title: 'Route to safety', caption: 'Turn-by-turn route to the nearest hospital or police station, chosen by AI.' },
  { name: 'seen', area: 'dashboard', title: 'Seen & heard', caption: 'What the AI saw on camera and heard in the background, in the caller’s language.' },
  { name: 'analytics', area: 'analytics', title: 'Analytics', caption: 'Incident hotspots, trend over time and severity mix across the whole team.' },
  { name: 'performance', area: 'analytics', title: 'Responder performance', caption: 'Workload, acknowledge and resolve times compared across responders.' },
]

const TABS: { id: 'all' | Area; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'app', label: 'QuickBite app' },
  { id: 'dashboard', label: 'Responder dashboard' },
  { id: 'analytics', label: 'Analytics' },
]

const src = (name: string) => `/shots/${name}.png?v=${__BUILD_ID__}`

export function Gallery() {
  const [tab, setTab] = useState<'all' | Area>('all')
  const [open, setOpen] = useState<string | null>(null)
  const shown = SHOTS.filter((s) => tab === 'all' || s.area === tab)
  const current = SHOTS.find((s) => s.name === open)
  return (
    <section id="gallery">
      <div className="container">
        <Reveal>
          <span className="eyebrow">Gallery</span>
          <h2 className="h2">Real screens, not mock-ups.</h2>
          <p className="muted" style={{ fontSize: 17, maxWidth: 640 }}>
            Captured from the live app and the responder dashboard during test calls. Tap any screen to see it full size.
          </p>
        </Reveal>
        <div className="gallery-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <motion.div layout className="gallery-grid">
          <AnimatePresence mode="popLayout">
            {shown.map((s) => (
              <motion.button
                layout
                key={s.name}
                className={`gallery-item${s.phone ? ' phone' : ''}`}
                onClick={() => setOpen(s.name)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              >
                <span className="gallery-img"><img src={src(s.name)} alt={s.title} loading="lazy" /></span>
                <span className="gallery-text"><b>{s.title}</b><small>{s.caption}</small></span>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      <Modal open={!!current} onClose={() => setOpen(null)} wide>
        {current && (
          <figure className="gallery-full">
            <img src={src(current.name)} alt={current.title} />
            <figcaption><b>{current.title}</b> — {current.caption}</figcaption>
          </figure>
        )}
      </Modal>
    </section>
  )
}
