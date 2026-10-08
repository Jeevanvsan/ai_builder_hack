import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'
import { LINKS, Phone, QuickBiteScreen } from './ui'

const SCRIPT = [
  { who: 'mia', text: 'Hi, QuickBite order desk! Is this order for yourself?' },
  { who: 'me', text: 'Yes, for me.' },
  { who: 'mia', text: "Garlic bread, family combo or kids' meal? Garlic bread means someone is following you…" },
  { who: 'me', text: 'Garlic bread, please.' },
  { who: 'mia', text: 'How many garlic breads? One for each person following you.' },
  { who: 'me', text: 'Two.' },
]
const FIELDS = [
  { k: 'Channel', v: 'Live call', c: 'live', at: 0 },
  { k: 'Situation', v: 'Being followed', c: 'high', at: 3 },
  { k: 'Followers', v: '2', c: 'med', at: 5 },
  { k: 'Voice stress', v: '78%', c: 'acc', at: 5 },
  { k: 'Severity', v: 'HIGH', c: 'high', at: 5 },
]
export default function Hero() {
  const [step, setStep] = useState(-1) // -1 = menu, 0..n = call lines
  const { scrollY } = useScroll()
  const yStage = useTransform(scrollY, [0, 600], [0, 90])

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s >= SCRIPT.length + 1 ? -1 : s + 1)), step === -1 ? 2600 : 1500)
    return () => clearTimeout(t)
  }, [step])

  const words = 'It looks like a food order.'.split(' ')

  return (
    <section className="hero" id="top">
      <div className="blob" style={{ width: 520, height: 520, background: 'var(--accent-glow)', top: -160, right: -120 }} />
      <div className="blob" style={{ width: 380, height: 380, background: 'var(--high-glow)', bottom: -120, left: -140, opacity: 0.25 }} />
      <div className="container hero-grid">
        <div>
          <motion.span className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Safety, disguised as dinner</motion.span>
          <h1>
            {words.map((w, i) => (
              <motion.span key={i} style={{ display: 'inline-block', marginRight: '0.25em' }} initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}>{w}</motion.span>
            ))}
            <br />
            <motion.span className="grad" style={{ display: 'inline-block' }} initial={{ opacity: 0, filter: 'blur(12px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ delay: 0.7, duration: 0.8 }}>
              It's a call for help.
            </motion.span>
          </h1>
          <motion.p className="lead" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
            Covert Call hides four ways to ask for help inside an ordinary food-delivery app: a Gemini Live order call, a coded cart, silent delivery instructions and a hidden SOS. Whatever the person picks, responders see a structured, live incident.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }}>
            <a className="btn btn-primary" href={LINKS.web} target="_blank" rel="noreferrer">Try the web app →</a>
          </motion.div>
          <motion.p className="web-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
            ★ Recommended: use the web app. It's the quickest way in, nothing to install, and has every feature.
          </motion.p>
          <motion.div className="hero-badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
            <span><i className="pulse" /> Live web app</span>
            <span>✦ Gemini Live</span>
            <span>⚡ Real-time dashboard</span>
          </motion.div>
        </div>

        <motion.div className="hero-stage" style={{ y: yStage }}>
          <motion.div initial={{ opacity: 0, y: 60, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ delay: 0.3, type: 'spring', stiffness: 80 }} className="phone-wrap">
            <Phone>
              <AnimatePresence mode="wait">
                {step === -1 ? (
                  <motion.div key="menu" style={{ height: '100%' }} exit={{ opacity: 0, scale: 1.08, filter: 'blur(6px)' }} transition={{ duration: 0.45 }}>
                    <QuickBiteScreen />
                  </motion.div>
                ) : (
                  <motion.div key="call" style={{ height: '100%' }} initial={{ clipPath: 'circle(0% at 50% 85%)' }} animate={{ clipPath: 'circle(150% at 50% 85%)' }} transition={{ duration: 0.7, ease: 'easeInOut' }}>
                    <div className="call">
                      <div className="call-avatar">M</div>
                      <h4>QuickBite Order Desk</h4>
                      <small>Order #QB-2041 · 00:{String(12 + Math.max(step, 0) * 4).padStart(2, '0')}</small>
                      {SCRIPT.slice(0, Math.min(step + 1, SCRIPT.length)).slice(-4).map((l) => (
                        <motion.div key={l.text} layout className={`bubble ${l.who}`} initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}>{l.text}</motion.div>
                      ))}
                      <div className="wave">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />)}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Phone>
          </motion.div>

          <motion.div className="dash-card" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, type: 'spring', stiffness: 80 }} style={{ position: 'absolute', right: 0, top: 120, zIndex: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>Responder dashboard</b>
              <span className="chip live" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><i className="pulse" /> LIVE</span>
            </div>
            {FIELDS.map((f) => {
              const shown = step >= f.at
              return (
                <div key={f.k} className="dash-row">
                  <span className="muted">{f.k}</span>
                  <AnimatePresence mode="wait">
                    {shown ? (
                      <motion.span key="v" className={`chip ${f.c}`} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [1.3, 1], opacity: 1 }} transition={{ type: 'spring' }}>{f.v}</motion.span>
                    ) : (
                      <motion.span key="d" style={{ color: 'var(--tone)' }} exit={{ opacity: 0 }}>—</motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>

          <motion.div className="dash-card hero-decoded" style={{ position: 'absolute', right: 40, bottom: 20, width: 230, zIndex: 2 }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: [0, -10, 0] }} transition={{ opacity: { delay: 0.9 }, y: { repeat: Infinity, duration: 5, ease: 'easeInOut' } }}>
            <small className="muted" style={{ fontWeight: 700 }}>CALLER ONLY SAYS A FOOD WORD</small>
            <div style={{ marginTop: 6, fontSize: 14 }}>"Garlic bread, two" → <b style={{ color: 'var(--high)' }}>followed by 2 people</b></div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
