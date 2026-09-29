import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { mockFor } from './Mocks'
import { Browser, Modal, Phone, Reveal, Shot, SwipeDots } from './ui'

/* ---------- mock fallbacks for screenshots ---------- */

function MockCall() {
  return (
    <div className="call" style={{ paddingTop: 70 }}>
      <div className="call-avatar">M</div>
      <h4>Mia · QuickBite Support</h4>
      <small>Confirming your order</small>
      <div className="bubble mia">Would you like the family combo tonight?</div>
      <div className="bubble me">Yes, for two please.</div>
      <div className="bubble mia">Any extra toppings?</div>
      <div className="wave">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />)}</div>
    </div>
  )
}

function MockExtraction() {
  const rows = [['Hurt', 'Yes', 'high'], ['People present', '2', 'med'], ['Attacker nearby', 'Yes', 'high'], ['Weapons', 'Unknown', 'acc'], ['Can get out', 'No', 'high']]
  return (
    <div className="mock">
      <div className="mock-row">
        <div className="mock-box"><small>Severity</small><b style={{ color: 'var(--high)' }}>HIGH · 86</b></div>
        <div className="mock-box"><small>Call</small><b style={{ color: 'var(--live)' }}>● Live 02:14</b></div>
        <div className="mock-box"><small>Channel</small><b>Voice</b></div>
      </div>
      <div className="mock-box">
        <small>Extracted live by Gemini</small>
        {rows.map(([k, v, c], i) => (
          <motion.div key={k} className="dash-row" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }} viewport={{ once: true }}>
            <span>{k}</span><span className={`chip ${c}`}>{v}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const STRESS = [18, 22, 20, 31, 46, 44, 58, 66, 63, 74, 82]
const STRESS_EVENTS = [
  { i: 0, label: 'Call starts' },
  { i: 4, label: '"Garlic bread"' },
  { i: 7, label: '"Two"' },
  { i: 10, label: 'Weapon mentioned' },
]

function MockStress() {
  const W = 400, H = 170, P = 14
  const x = (i: number) => P + (i / (STRESS.length - 1)) * (W - P * 2)
  const y = (v: number) => H - P - (v / 100) * (H - P * 2)
  const line = STRESS.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(STRESS.length - 1)},${H - P} L${x(0)},${H - P} Z`
  const score = STRESS[STRESS.length - 1]
  const arc = 2 * Math.PI * 42
  return (
    <div className="stress-mock">
      <div className="stress-top">
        <div className="mock-box stress-gauge">
          <svg viewBox="0 0 100 100" width="96" height="96">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#edf1f7" strokeWidth="10" />
            <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#sg)" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 50 50)"
              strokeDasharray={arc} initial={{ strokeDashoffset: arc }} whileInView={{ strokeDashoffset: arc * (1 - score / 100) }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeOut' }} />
            <defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stopColor="#c47600" /><stop offset="1" stopColor="#d92a3f" /></linearGradient></defs>
            <text x="50" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill="#d92a3f">{score}</text>
          </svg>
          <div><small>Voice stress</small><b style={{ color: 'var(--high)' }}>High</b><span className="chip high" style={{ marginTop: 6, display: 'inline-block' }}>↑ Rising</span></div>
        </div>
        <div className="mock-box">
          <small>Feeds severity</small>
          <div className="dash-row"><span>Words say</span><span className="chip med">MEDIUM</span></div>
          <div className="dash-row"><span>Voice says</span><span className="chip high">HIGH</span></div>
          <div className="dash-row"><span>Incident</span><span className="chip high">HIGH</span></div>
        </div>
      </div>
      <div className="mock-box">
        <small>Stress over the call · every 15–20 s</small>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }}>
          <defs>
            <linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d92a3f" stopOpacity=".32" /><stop offset="1" stopColor="#d92a3f" stopOpacity="0" /></linearGradient>
          </defs>
          {[25, 50, 75].map((g) => <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#e6ebf3" strokeDasharray="4 4" />)}
          <rect x={P} y={y(100)} width={W - P * 2} height={y(70) - y(100)} fill="#d92a3f" opacity=".05" />
          <text x={W - P - 2} y={y(70) - 5} textAnchor="end" fontSize="10" fill="#d92a3f" fontWeight="700">high-stress zone</text>
          <motion.path d={area} fill="url(#sa)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 0.8 }} />
          <motion.path d={line} fill="none" stroke="#d92a3f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeInOut' }} />
          {STRESS_EVENTS.map((e, k) => (
            <motion.g key={e.i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 + k * 0.35 }} style={{ transformOrigin: `${x(e.i)}px ${y(STRESS[e.i])}px` }}>
              <circle cx={x(e.i)} cy={y(STRESS[e.i])} r="5" fill="#fff" stroke="#d92a3f" strokeWidth="2.5" />
              <text x={x(e.i)} y={y(STRESS[e.i]) - 11} textAnchor={k === 0 ? 'start' : k === STRESS_EVENTS.length - 1 ? 'end' : 'middle'} fontSize="10.5" fontWeight="700" fill="#12151c">{e.label}</text>
            </motion.g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function MockGeneric({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mock">
      <div className="mock-box"><small>{title}</small>
        {lines.map((l) => <div key={l} className="dash-row"><span>{l}</span></div>)}
      </div>
      <div className="mock-row">
        <div className="mock-box"><div className="bar"><div style={{ width: '70%', background: 'var(--accent)' }} /></div></div>
        <div className="mock-box"><div className="bar"><div style={{ width: '45%', background: 'var(--live)' }} /></div></div>
      </div>
    </div>
  )
}

/* ---------- same-breath coding: Mia states every meaning, the caller only picks a food word ---------- */

const CODE_TABLE = [
  ['Cheesy Garlic Bread', 'Being followed'],
  ['Family Combo', 'Witnessed a crime'],
  ["Kids' Meal Box", 'Child in danger'],
  ['Choco Lava Cake', 'Domestic violence'],
  ['Party Platter', 'Group fight'],
  ['Mint Lemonade', 'Hazard (fire, gas…)'],
  ['Extra Pepperoni', 'Weapon involved'],
  ['Extra Spicy', 'Being harmed now'],
  ['Extra Cheese', 'Locked in / confined'],
  ['Extra Napkins', 'Injured'],
  ['Sealed To-Go Box', 'Being taken'],
]

const CALL_LINES = [
  { who: 'mia', text: '"Garlic bread, a family combo or a kids\' meal? Garlic bread means someone is following you, family combo means you saw a crime, kids\' meal means a child is in danger."' },
  { who: 'me', text: '"Garlic bread, please."' },
  { who: 'mia', text: '"How many garlic breads? One for each person following you."' },
  { who: 'me', text: '"Two."' },
]

function CodedTranscript() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % (CALL_LINES.length + 2)), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="code-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <b>Same-breath coding</b>
        <span className={`chip ${n > CALL_LINES.length ? 'high' : 'live'}`}>{n > CALL_LINES.length ? 'DECODED: FOLLOWED BY 2' : 'ORDINARY ORDER CALL'}</span>
      </div>
      <div style={{ minHeight: 190 }}>
        {CALL_LINES.slice(0, n).map((l) => (
          <motion.div key={l.text} className={`bubble ${l.who}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '92%' }}>{l.text}</motion.div>
        ))}
      </div>
      <small className="muted" style={{ fontWeight: 700, letterSpacing: '.06em' }}>ONE CODE TABLE, SHARED BY THE CALL AND THE CART</small>
      <div className="code-grid">
        {CODE_TABLE.map(([food, meaning]) => (
          <div key={food} className="code-pill"><span>{food}</span><span>{meaning}</span></div>
        ))}
      </div>
    </div>
  )
}

function MockCart() {
  return (
    <div className="qb">
      <div className="qb-top"><span className="qb-brand">Your cart</span><span>🛒 3</span></div>
      {[['🍞', 'Cheesy Garlic Bread', '×2'], ['🍕', 'Margherita Pizza', '×1'], ['📦', 'Sealed To-Go Box', '×1']].map(([e, n, q]) => (
        <div key={n} className="qb-item"><div className="qb-thumb">{e}</div><div><b>{n}</b>{q}</div></div>
      ))}
      <div className="qb-search" style={{ marginTop: 12, color: '#333' }}>🛵 Delivery speed: <b>Express</b></div>
      <div style={{ marginTop: 14, background: '#e23744', color: '#fff', textAlign: 'center', padding: 12, borderRadius: 12, fontWeight: 700 }}>Place order</div>
      <p style={{ textAlign: 'center', color: '#999', fontSize: 11 }}>Hold an item image to see details</p>
    </div>
  )
}

function MockSos() {
  return (
    <div style={{ height: '100%', background: '#000', display: 'grid', placeItems: 'center', color: '#222', fontSize: 12 }}>
      <motion.span animate={{ opacity: [0.15, 0.4, 0.15] }} transition={{ repeat: Infinity, duration: 3 }}>screen looks switched off</motion.span>
    </div>
  )
}

/* ---------- deep dives ---------- */

type Dive = { tag: string; usp?: boolean; title: ReactNode; body: string; ticks: string[]; visual: ReactNode }

const DIVES: Dive[] = [
  {
    tag: 'Call to order · Gemini Live', usp: true,
    title: <>To anyone listening, it's <span className="grad">just an order call.</span></>,
    body: "Mia is a real-time Gemini Live voice agent who stays in character as QuickBite's order desk. She works like an investigator in disguise: she asks who the order is for, offers food choices for the situation, then drills down with follow-ups on headcount, weapons, injuries, clothing, vehicle, movement and address.",
    ticks: ['Open mode: if the caller can talk freely, Mia drops the food cover and speaks like a dispatcher', 'Low-latency native audio, with auto-reconnect if the connection drops', 'Speaks the caller\'s language (e.g. Malayalam) with the same codes', 'Gives brief safety advice in character, logged for responders'],
    visual: <div style={{ display: 'grid', placeItems: 'center' }}><Phone><Shot name="call" alt="Call to order screen" fallback={<MockCall />} /></Phone></div>,
  },
  {
    tag: 'Same-breath coding', usp: true,
    title: <>The caller never has to <span className="grad">remember a code.</span></>,
    body: "Every option Mia offers comes with its real meaning in the same sentence. The caller just repeats a food word and a number, which sounds like an ordinary order to anyone nearby. The same code table drives the coded menu, so the call and the cart can never disagree.",
    ticks: ['11 scenario codes plus drill-down follow-ups', 'Quantity = how many people', 'If the caller goes quiet, Mia gently repeats the options'],
    visual: <CodedTranscript />,
  },
  {
    tag: 'Click & order', usp: true,
    title: <>Can't talk? <span className="grad">The order is the message.</span></>,
    body: "Some menu items and add-ons carry a meaning. Quantity gives the headcount and delivery speed gives the urgency. Placing an order that includes coded items raises a decoded incident with rough GPS/IP location. An order with no coded items raises nothing.",
    ticks: ['Long-press an item image to check its meaning; ordinary items reveal nothing', 'Coded and ordinary orders land on the identical order-placed screen', 'Delivery status on that screen mirrors the responder\'s progress'],
    visual: <div style={{ display: 'grid', placeItems: 'center' }}><Phone><Shot name="click-order" alt="Coded cart" fallback={<MockCart />} /></Phone></div>,
  },
  {
    tag: 'Heart double-tap SOS', usp: true,
    title: <>The phone looks off. <span className="grad">It's streaming everything.</span></>,
    body: "For hostage situations, a double-tap on the heart icon starts a silent SOS. The screen goes black and swallows every touch while both cameras and the mic stream live to responders. A silent Gemini observer, whose audio is never played, fills in the incident by itself: captors, weapons, injuries, overheard names and demands.",
    ticks: ['Both cameras where the phone allows, back-only otherwise', 'Recording uploaded to the team Drive every ~20 s', 'Three taps anywhere end it with zero trace'],
    visual: <div style={{ display: 'grid', placeItems: 'center' }}><Phone><Shot name="sos" alt="Blacked-out SOS screen" fallback={<MockSos />} /></Phone></div>,
  },
  {
    tag: 'Second AI layer',
    title: <>It reads the voice, <span className="grad">not just the words.</span></>,
    body: 'Words can be forced, but stress in a voice is harder to hide. Gemini Live’s native audio scores voice stress every 15 to 20 seconds and plots the trend, so responders can tell a calm order from a caller in fear.',
    ticks: ['Per-call stress score and trend line', 'Live queue can be sorted by voice stress', 'Feeds into the live severity ranking'],
    visual: <Browser url="dashboard · voice stress"><Shot name="stress" alt="Voice stress meter" fallback={<MockStress />} /></Browser>,
  },
  {
    tag: 'Live structured extraction',
    title: <>A conversation in, <span className="grad">an incident report out</span>, as it happens.</>,
    body: "Gemini function calling turns each answer into typed incident fields as soon as it's spoken, and Firestore listeners push them to the dashboard in under a second. Severity is recalculated live and never drops mid-call. When the call ends, a consolidation pass writes the full case record.",
    ticks: ['Danger tags, people count, injuries, weapons, address', 'Camera frames (~1 fps) and background sounds logged as "Seen & heard"', 'Voice-stress score and trend feed into severity'],
    visual: <Browser url="dashboard · incident"><Shot name="extraction" alt="Live extracted fields" fallback={<MockExtraction />} /></Browser>,
  },
]

export function DeepDives() {
  return (
    <section id="features">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">What makes it different</span>
            <h2>What no other SOS app does.</h2>
            <p className="muted">Each of the four ways in hides behind something ordinary. Behind all of them is one Gemini pipeline that turns disguised signals into a live incident.</p>
          </div>
        </Reveal>
        <div className="swipe-hint">Swipe to see all {DIVES.length} →</div>
        <div className="dives" id="row-dives">
        {DIVES.map((d, i) => (
          <div key={d.tag} className={`dive${i % 2 ? ' flip' : ''}`}>
            <Reveal x={i % 2 ? 40 : -40} y={0}>
              <div className="dive-text">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.usp && <span className="usp">★ USP</span>}
                  <span className="tag">{d.tag}</span>
                </div>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
                <ul className="ticks">{d.ticks.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </Reveal>
            <Reveal x={i % 2 ? -60 : 60} y={0} delay={0.1}><div className="dive-visual">{d.visual}</div></Reveal>
          </div>
        ))}
        </div>
        <SwipeDots target="row-dives" />
      </div>
    </section>
  )
}

/* ---------- bento grid with lightbox ---------- */

type Card = { ico: string; title: string; body: string; shot: string; cls?: string }
const CARDS: Card[] = [
  { ico: '📝', title: 'Delivery instructions', body: 'A silent, tap-only path styled as rider instructions: chips, a note for the rider and a photo that Gemini vision reads. There is no call button on it.', shot: 'silent', cls: 'span-2' },
  { ico: '📍', title: 'Smart location', body: 'GPS, then IP fallback, then an address confirmed through a normal "delivery address" question.', shot: 'map', cls: 'row-2' },
  { ico: '🧭', title: 'Movement-aware routing', body: 'Navigation is relayed only when the caller is followed or on the move, never otherwise.', shot: 'route' },
  { ico: '🎥', title: 'Live video + Drive', body: 'Peer-to-peer WebRTC to the dashboard, with a copy saved to the team Drive during the call.', shot: 'video' },
  { ico: '👂', title: 'Seen & heard', body: 'Gunshots, screams, other voices, and what the camera shows, logged separately from what the caller says.', shot: 'seen' },
  { ico: '🧹', title: 'Zero-trace exit', body: 'Report sent and backed out look identical. Instant, no dialog, and Back never returns.', shot: 'exit' },
  { ico: '🚨', title: 'Responder command centre', body: 'Live queue sorted by risk, time or stress. A repeating siren, one-claim acknowledge, and SOS and coded-order badges.', shot: 'queue', cls: 'span-2' },
  { ico: '🔎', title: 'Natural-language search', body: '"Calls near MG Road last week with injuries", answered by Gemini.', shot: 'search' },
  { ico: '📊', title: 'Analytics + AI Insights', body: 'Hotspots, time patterns and Gemini-written prevention actions, refreshed daily.', shot: 'analytics', cls: 'span-2' },
  { ico: '🏅', title: 'Responder performance', body: 'Admin-only view of acknowledged vs resolved, workload share and speed vs volume for each responder.', shot: 'performance', cls: 'span-2' },
  { ico: '🎭', title: 'Your own disguise', body: 'In the Android app you can change the icon and name so it blends in with the apps already on the phone.', shot: 'appearance', cls: 'span-2' },
]

export function Bento() {
  const [open, setOpen] = useState<Card | null>(null)
  return (
    <section className="dark" id="more">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">And everything around it</span>
            <h2>Everything else, for the caller and the responder.</h2>
            <p className="muted">Click any card to see it in the product.</p>
          </div>
        </Reveal>
        <div className="swipe-hint">Swipe for more →</div>
        <div className="bento" id="row-bento">
          {CARDS.map((c, i) => (
            <motion.button
              key={c.title}
              className={`bento-card ${c.cls ?? ''}`}
              onClick={() => setOpen(c)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
              }}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -6 }}
              viewport={{ once: true, margin: '-60px 0px' }}
              transition={{ delay: (i % 4) * 0.08, type: 'spring', stiffness: 160, damping: 20 }}
            >
              <span className="ico">{c.ico}</span>
              <span className="open">View ↗</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </motion.button>
          ))}
        </div>
        <SwipeDots target="row-bento" dark />
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} wide>
        {open && (
          <div>
            <Browser url={`covert call · ${open.title.toLowerCase()}`}>
              <Shot name={open.shot} alt={open.title} fallback={mockFor(open.shot) ?? <MockGeneric title={open.title} lines={[open.body]} />} />
            </Browser>
            <h3 style={{ marginTop: 18 }}>{open.ico} {open.title}</h3>
            <p style={{ marginBottom: 0 }}>{open.body}</p>
          </div>
        )}
      </Modal>
    </section>
  )
}
