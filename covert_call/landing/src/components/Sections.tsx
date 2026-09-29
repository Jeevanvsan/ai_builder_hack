import { animate, motion, useInView, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LINKS, Phone, QuickBiteScreen, Reveal, Shot, SwipeDots } from './ui'

export function Nav({ onDownload }: { onDownload: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 30))
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <motion.div style={{ scaleX: scrollYProgress, transformOrigin: 'left', height: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent-glow))', position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="container nav-inner">
        <a href="#top" className="logo"><span className="logo-dot" />Covert Call</a>
        <div className="nav-links">
          <a href="#disguise">Disguise</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#demo">Demo</a>
          <a href="#download">Download</a>
        </div>
        <div className="nav-cta">
          <a className="btn btn-ghost" href={LINKS.github} target="_blank" rel="noreferrer">GitHub</a>
          <button className="btn btn-primary" onClick={onDownload}>Get the app</button>
        </div>
      </div>
    </nav>
  )
}

function CountUp({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 2, ease: 'easeOut', onUpdate: (n) => setV(Math.round(n)) })
    return () => c.stop()
  }, [inView, to])
  return <b ref={ref}>{prefix}{v.toLocaleString('en-IN')}{suffix}</b>
}

export function Problem() {
  return (
    <section id="problem">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">The problem</span>
            <h2>The people who most need help often <span className="grad">can't be seen asking for it.</span></h2>
            <p className="muted">When someone is being watched, a call to an emergency line can make things more dangerous. A "wrong number" pizza order has saved lives before. We turned that instinct into a system.</p>
          </div>
        </Reveal>
        <div className="swipe-hint">Swipe for more →</div>
        <div className="stats" id="row-stats">
          {[
            { n: <CountUp to={1} suffix=" in 3" />, t: 'women worldwide experience physical or sexual violence in their lifetime.', c: 'WHO, 2021' },
            { n: <CountUp to={51100} />, t: 'women and girls were killed by an intimate partner or family member in 2023.', c: 'UNODC / UN Women, 2024' },
            { n: <CountUp to={0} suffix=" sec" />, t: 'of suspicion. To anyone watching, a Covert Call is just someone ordering dinner.', c: 'By design' },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div className="stat">{s.n}<p>{s.t}</p><cite>{s.c}</cite></div>
            </Reveal>
          ))}
        </div>
        <SwipeDots target="row-stats" />
      </div>
    </section>
  )
}

export function Disguise() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })
  const phones = [
    { v: 'item' as const, shot: 'qb-item', r: -12, x: 60, label: 'Coded item' },
    { v: 'home' as const, shot: 'qb-home', r: 0, x: 0, label: 'Home' },
    { v: 'checkout' as const, shot: 'qb-checkout', r: 12, x: -60, label: 'Checkout' },
  ]
  return (
    <section id="disguise" style={{ background: 'linear-gradient(180deg, var(--bg), #fff 60%, var(--bg))' }}>
      <div className="container">
        <Reveal>
          <div className="section-head" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow">The disguise · QuickBite</span>
            <h2>Looks like dinner. <span className="grad">Works like a lifeline.</span></h2>
            <p className="muted">QuickBite is a fully working food-delivery app with a menu, cart and checkout. There's no install footprint on the web and nothing on screen that says "safety". Every way to ask for help is an ordinary part of it: a call to order, the cart, delivery instructions and the heart icon.</p>
          </div>
        </Reveal>
        <div className="fan" ref={ref}>
          {phones.map((p, i) => (
            <motion.div key={p.v} style={{ zIndex: i === 1 ? 3 : 1, marginInline: -30 }}
              initial={{ opacity: 0, y: 120, rotate: 0, x: 0 }}
              animate={inView ? { opacity: 1, y: i === 1 ? 0 : 40, rotate: p.r, x: p.x } : {}}
              whileHover={{ y: -20, rotate: 0, scale: 1.04, zIndex: 5 }}
              transition={{ type: 'spring', stiffness: 90, damping: 16, delay: i * 0.12 }}>
              <Phone><Shot name={p.shot} alt={`QuickBite ${p.label}`} fallback={<QuickBiteScreen variant={p.v} />} /></Phone>
              <div className="fan-caption">{p.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const MODES = [
  {
    t: 'Call to order', when: 'Can talk', emoji: '📞', where: 'Home → "Call to order"',
    d: "A Gemini Live order call with Mia. She offers food choices and says each one's real meaning in the same sentence, so the caller only has to pick a food word.",
    flow: ['Mia asks: "talk" or "order"? "Talk" switches to open mode, with no codes', 'Picks a category: "garlic bread" = being followed', 'Follow-ups: how many, weapons, injuries, address', 'Camera frames and background sounds read by Gemini', 'Safety advice given in character'],
  },
  {
    t: 'Click & order', when: "Can't talk, can tap", emoji: '🛒', where: 'Home → menu → checkout',
    d: 'Some menu items and add-ons are coded. Quantity is the headcount and delivery speed is the urgency. Placing the order raises a decoded incident. An ordinary order raises nothing.',
    flow: ['Add a coded item, e.g. "Sealed To-Go Box" = taken', 'Long-press the image to check its meaning', 'Quantity = people involved', 'Place order → decoded incident', 'Order-placed screen mirrors the response as delivery status'],
  },
  {
    t: 'Delivery instructions', when: "Can't make any sound", emoji: '📝', where: 'Home → "Delivery instructions"',
    d: "A silent tap-only form that looks like rider instructions: tap options, a note for the rider and an optional photo that Gemini reads. There's no call button anywhere on this path.",
    flow: ['Tap instruction chips (hold for detail)', 'Note for rider + delivery address', 'Optional photo, analysed by Gemini vision', 'Save instructions → incident', 'Same zero-trace exit as the call'],
  },
  {
    t: 'Heart double-tap SOS', when: "Being held, can't touch the phone", emoji: '🖤', where: 'Home → double-tap the ♡',
    d: 'A hidden silent SOS for hostage situations. The screen goes black as if the phone is off, while both cameras and the mic stream live. A silent Gemini observer builds the incident on its own.',
    flow: ['Double-tap the heart (within 400 ms)', 'Screen turns black and swallows touches', 'Both cameras + mic stream to responders', 'AI logs captors, weapons, demands, sounds', 'Three taps anywhere end it and leave no trace'],
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(MODES.length - 1, Math.floor(v * MODES.length))))
  const m = MODES[active]
  return (
    <section className="how dark" id="how" ref={ref}>
      <div className="how-sticky">
        <div className="container how-grid">
          <div>
            <span className="eyebrow">Four ways in</span>
            <h2 style={{ color: '#fff' }}>One app. Four separate ways to ask for help.</h2>
            <p className="muted" style={{ margin: '0 0 22px', lineHeight: 1.6 }}>Each starts from Home and is a separate path, never a sequence. The person picks whichever one is safe right now.</p>
            <div className="how-progress"><motion.div style={{ scaleX: scrollYProgress }} /></div>
            <div className="swipe-hint">Swipe through the four →</div>
            <div className="how-steps" id="row-how">
              {MODES.map((s, i) => (
                <div key={s.t} className={`how-step${i === active ? ' on' : ''}`}>
                  <h3><span>0{i + 1}</span>{s.t}<small className="mode-when">{s.when}</small></h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
            <SwipeDots target="row-how" dark />
          </div>
          <div className="how-visual">
            <motion.div key={active} className="mode-card" initial={{ opacity: 0, y: 40, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
              <div className="mode-emoji">{m.emoji}</div>
              <b style={{ fontSize: 22 }}>{m.t}</b>
              <div className="mode-where">{m.where}</div>
              <ol className="mode-flow">
                {m.flow.map((f, i) => (
                  <motion.li key={f} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>{f}</motion.li>
                ))}
              </ol>
            </motion.div>
            {[0, 1].map((i) => (
              <motion.div key={i} style={{ position: 'absolute', width: 480 + i * 90, height: 480 + i * 90, borderRadius: '50%', border: '1px dashed var(--ink-border)', zIndex: 0 }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 34 + i * 12, ease: 'linear' }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Compare() {
  const rows = [
    ['Looks innocent to someone watching', 0, 0, 0, 1],
    ['Two-way conversation', 1, 0, 0, 1],
    ['Works without saying anything alarming', 0, 1, 1, 1],
    ['Works with no sound and no touching', 0, 0, 0, 1],
    ['Structured data for responders, live', 0, 0, 1, 1],
    ['Live video of the scene', 0, 0, 0, 1],
    ['Voice-stress analysis', 0, 0, 0, 1],
  ] as const
  return (
    <section>
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">Why not just…</span>
            <h2>Every other option has a tell.</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className="compare-wrap">
            <table className="compare">
              <thead><tr><th /><th className="us">Covert Call</th><th>Emergency call</th><th>SOS button</th><th>Safety apps</th></tr></thead>
              <tbody>
                {rows.map(([label, ...vals], r) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {[vals[3], vals[0], vals[1], vals[2]].map((v, c) => (
                      <td key={c} className={c === 0 ? 'us' : ''}>
                        <motion.span className={v ? 'yes' : 'no'} style={{ display: 'inline-block' }} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', delay: r * 0.07 + c * 0.05 }}>{v ? '✓' : '–'}</motion.span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const VIDEOS = [
  { file: 'call', title: 'Covert Call', d: 'The whole idea: a food-delivery app that hides a call for help.' },
  { file: 'chased-call', title: 'Someone chasing, free to speak', d: 'Open mode: the caller says "talk", Mia drops the food cover and acts as a calm dispatcher, guiding them to safety while responders track them live.' },
  { file: 'sos', title: 'Heart double-tap SOS', d: 'The screen goes black, both cameras stream, and the AI observes silently.' },
  { file: 'click-order', title: 'Tap and order', d: 'A coded cart is placed and arrives as a decoded incident.' },
]

function VideoSlide({ v, active }: { v: (typeof VIDEOS)[number]; active: boolean }) {
  const [missing, setMissing] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    if (active) ref.current.play().catch(() => {})
    else ref.current.pause()
  }, [active])
  return (
    <div className="slide-media">
      {!missing && <video ref={ref} src={`/videos/${v.file}.mp4?v=${__BUILD_ID__}`} muted loop playsInline controls={active} onError={() => setMissing(true)} />}
      {missing && (
        <div className="slide-placeholder">
          <div><div className="play">▶</div><b style={{ color: '#fff' }}>{v.title}</b><br /><small>Demo clip coming soon</small></div>
        </div>
      )}
    </div>
  )
}

export function DemoSlider() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const [slideW, setSlideW] = useState(784)
  useEffect(() => {
    const measure = () => {
      const el = trackRef.current?.firstElementChild as HTMLElement | null
      if (el) setSlideW(el.offsetWidth + 24)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setI((n) => (n + 1) % VIDEOS.length), 7000)
    return () => clearTimeout(t)
  }, [i, paused])
  const go = (n: number) => setI((n + VIDEOS.length) % VIDEOS.length)

  return (
    <section className="dark" id="demo" style={{ overflow: 'hidden' }}>
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">See it working</span>
            <h2 style={{ color: '#fff' }}>Demo videos</h2>
            <p className="muted">Drag, swipe or use the arrows.</p>
          </div>
        </Reveal>
        <div className="slider" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <motion.div ref={trackRef} className="slides" animate={{ x: -i * slideW }} transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            drag="x" dragConstraints={{ left: -(VIDEOS.length - 1) * slideW, right: 0 }} dragElastic={0.15}
            onDragEnd={(_, info) => { if (info.offset.x < -80) go(i + 1); else if (info.offset.x > 80) go(i - 1) }}>
            {VIDEOS.map((v, n) => (
              <motion.div key={v.file} className="slide" animate={{ opacity: n === i ? 1 : 0.4, scale: n === i ? 1 : 0.94 }}>
                <VideoSlide v={v} active={n === i} />
                <div className="slide-info"><div><h3>{v.title}</h3><p>{v.d}</p></div><span className="chip acc">0{n + 1}</span></div>
              </motion.div>
            ))}
          </motion.div>
          <div className="slider-ctrl">
            <button className="arrow" onClick={() => go(i - 1)} aria-label="Previous">←</button>
            <button className="arrow" onClick={() => go(i + 1)} aria-label="Next">→</button>
            <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
              {VIDEOS.map((v, n) => <button key={v.file} className={`dotbtn${n === i ? ' on' : ''}`} onClick={() => go(n)} aria-label={v.title} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const MOMENTS = [
  { mia: 'QuickBite order desk! Is this order for yourself?', me: 'Yes, for me.', field: 'Caller', value: 'In trouble: self', tone: 'high' },
  { mia: 'Garlic bread, family combo or kids\u2019 meal? Garlic bread means someone is following you\u2026', me: 'Garlic bread.', field: 'Situation', value: 'Being followed', tone: 'high' },
  { mia: 'How many garlic breads? One for each person following you.', me: 'Two.', field: 'People', value: '2 followers', tone: 'med' },
  { mia: 'Extra pepperoni? That means they have a weapon.', me: 'Yes, extra pepperoni.', field: 'Weapon', value: 'Reported', tone: 'high' },
  { mia: 'And where should the rider deliver?', me: 'Main Road, near the market.', field: 'Location', value: 'Main Road, Vazhicherry', tone: 'live' },
]

export function SplitView() {
  const [n, setN] = useState(0)
  const [auto, setAuto] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-150px' })
  useEffect(() => {
    if (!auto || !inView) return
    const t = setTimeout(() => setN((v) => (v + 1) % MOMENTS.length), 3200)
    return () => clearTimeout(t)
  }, [n, auto, inView])
  const m = MOMENTS[n]
  const severity = n >= 3 ? 'HIGH' : n >= 1 ? 'MEDIUM' : 'LOW'
  return (
    <section>
      <div className="container" ref={ref}>
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">Two sides, one call</span>
            <h2>What the caller says <span className="grad">→</span> what the responder sees.</h2>
            <p className="muted">The same moment, at the same time. Click a step to replay it.</p>
          </div>
        </Reveal>
        <div className="sync">
          <div className="sync-side">
            <div className="sync-label">🍕 CALLER · QUICKBITE</div>
            <Phone style={{ transform: 'scale(.9)', transformOrigin: 'top center' }}>
              <div className="call" style={{ paddingTop: 56 }}>
                <div className="call-avatar" style={{ width: 56, height: 56, fontSize: 22 }}>Q</div>
                <h4>QuickBite Order Desk</h4>
                <small>Order call</small>
                <motion.div key={'m' + n} className="bubble mia" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{m.mia}</motion.div>
                <motion.div key={'c' + n} className="bubble me" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>{m.me}</motion.div>
                <div className="wave">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />)}</div>
              </div>
            </Phone>
            <p className="sync-note">Sounds like: an ordinary food order</p>
          </div>

          <div className="sync-wire" aria-hidden>
            <motion.span key={n} className="sync-packet" initial={{ left: '0%', opacity: 0 }} animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }} transition={{ delay: 1, duration: 0.9, ease: 'easeInOut' }} />
            <small>Gemini decodes</small>
          </div>

          <div className="sync-side">
            <div className="sync-label">🚨 RESPONDER · DASHBOARD</div>
            <div className="dash-card sync-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <b>INC-QB2041</b>
                <motion.span key={severity} className={`chip ${severity === 'HIGH' ? 'high' : severity === 'MEDIUM' ? 'med' : 'live'}`} initial={{ scale: 0.5 }} animate={{ scale: 1 }}>{severity}</motion.span>
              </div>
              {MOMENTS.map((x, i) => (
                <div key={x.field} className={`dash-row${i === n ? ' sync-hit' : ''}`}>
                  <span className="muted">{x.field}</span>
                  {i <= n ? (
                    <motion.span key={i === n ? 'hit' + n : 'on'} className={`chip ${x.tone}`} initial={i === n ? { scale: 0.3, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i === n ? 1.9 : 0, type: 'spring' }}>{x.value}</motion.span>
                  ) : <span style={{ color: 'var(--tone)' }}>—</span>}
                </div>
              ))}
            </div>
            <p className="sync-note">Reads as: a structured incident</p>
          </div>
        </div>
        <div className="sync-steps">
          {MOMENTS.map((x, i) => (
            <button key={x.field} className={`sync-step${i === n ? ' on' : ''}${i < n ? ' done' : ''}`} onClick={() => { setAuto(false); setN(i) }}>
              <span>{i + 1}</span>{x.field}
            </button>
          ))}
          <button className="sync-step" onClick={() => setAuto((v) => !v)}>{auto ? '❚❚ Pause' : '▶ Play'}</button>
        </div>
      </div>
    </section>
  )
}

export function Marquee() {
  const items = ['✦ Gemini Live', '🧠 Gemini function calling', '🔥 Firebase Hosting', '⚡ Cloud Firestore', '🔐 Firebase Auth', '☁️ Cloud Run', '📡 WebRTC', '⚛️ React + Vite', '📱 React Native', '📈 Apache ECharts', '🗺️ Leaflet / OSM']
  return (
    <section style={{ padding: '70px 0' }}>
      <div className="container" style={{ textAlign: 'center', marginBottom: 30 }}><span className="eyebrow">Built with</span></div>
      <div className="marquee">
        <div className="marquee-track">{[...items, ...items].map((t, i) => <span key={i} className="marquee-item">{t}</span>)}</div>
      </div>
    </section>
  )
}

export function Download({ onDownload }: { onDownload: () => void }) {
  return (
    <section id="download">
      <div className="container">
        <Reveal>
          <div className="download-card">
            <div className="blob" style={{ width: 400, height: 400, background: 'var(--accent)', right: -100, top: -150, opacity: 0.35 }} />
            <div style={{ position: 'relative' }}>
              <span className="eyebrow">Get Covert Call</span>
              <h2>Try it now, in your browser or on Android.</h2>
              <p className="muted" style={{ fontSize: 17, lineHeight: 1.6 }}>The web app runs live on Firebase with nothing to install. The Android build carries the same disguise as a real app icon.</p>
            </div>
            <div className="dl-options" style={{ position: 'relative' }}>
              <button className="dl-opt" onClick={onDownload}><span className="ico">🤖</span><span><b>Download APK</b><small>Android · React Native build</small></span><span className="go">⬇</span></button>
              <a className="dl-opt" href={LINKS.web} target="_blank" rel="noreferrer"><span className="ico">🍕</span><span><b>Open QuickBite web app</b><small>quickbite-5cde0.web.app</small></span><span className="go">↗</span></a>
              <a className="dl-opt" href={LINKS.github} target="_blank" rel="noreferrer"><span className="ico">💻</span><span><b>Source on GitHub</b><small>Public repository</small></span><span className="go">↗</span></a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo"><span className="logo-dot" />Covert Call</div>
            <p style={{ lineHeight: 1.6, maxWidth: 340, margin: 0 }}>A call for help that looks like a food order. Powered by Gemini on Google Cloud.</p>
            <div className="safety">In an emergency, call your local emergency number if it's safe to do so. Covert Call supports, and does not replace, emergency services.</div>
          </div>
          <div><h4>Product</h4><ul><li><a href="/#disguise">Disguise</a></li><li><a href="/#how">How it works</a></li><li><a href="/#features">Features</a></li><li><a href="/#demo">Demo</a></li></ul></div>
          <div><h4>Try it</h4><ul><li><a href={LINKS.web} target="_blank" rel="noreferrer">Web app</a></li><li><a href="/#download">Android APK</a></li></ul></div>
          <div><h4>Project</h4><ul><li><a href={LINKS.github} target="_blank" rel="noreferrer">GitHub</a></li><li>Team: Jeevan &amp; Ameen</li><li><a href="/privacy">Privacy Policy</a></li></ul></div>
        </div>
        <div className="footer-note"><span>© 2026 Covert Call team · <a href="/privacy">Privacy Policy</a></span><span>Made with Gemini on Google Cloud</span></div>
      </div>
    </footer>
  )
}
