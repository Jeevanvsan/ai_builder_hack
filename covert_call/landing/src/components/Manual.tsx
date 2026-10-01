import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { LINKS } from './ui'

// User manual (/manual): every feature as What / When / How, written for the person using QuickBite.

type Feature = {
  id: string
  icon: string
  title: string
  tag: string
  what: ReactNode
  when: string[]
  how: ReactNode[]
  tips?: string[]
}

const FEATURES: Feature[] = [
  {
    id: 'call',
    icon: '📞',
    title: 'Call to order',
    tag: 'You can talk: freely, or with someone listening',
    what: <>A phone call to the &ldquo;QuickBite order desk&rdquo;. Mia, an AI assistant, sounds like a normal restaurant staff member, but everything you tell her goes straight to a response team as a live emergency report.</>,
    when: [
      'You can speak, even if someone nearby might be listening.',
      'You are being followed, threatened, or are somewhere unsafe and need guidance.',
      'You want to report something happening to someone else.',
    ],
    how: [
      <>Open QuickBite and, with an <b>empty cart</b>, tap <b>Call to order</b> at the bottom of the home screen.</>,
      <>Mia greets you and asks whether you can talk freely. Say <b>&ldquo;talk&rdquo;</b> if you are alone and safe to speak, or <b>&ldquo;order&rdquo;</b> if someone might be listening.</>,
      <><b>If you said &ldquo;order&rdquo;:</b> Mia offers food choices and says what each one really means in the same sentence (e.g. &ldquo;garlic bread means someone is following you&rdquo;). Just repeat the food word and a number. You never need to remember any codes.</>,
      <><b>If you said &ldquo;talk&rdquo;:</b> Mia drops the food cover and speaks like a calm emergency dispatcher. Answer her plainly.</>,
      <>Always give your <b>exact location</b> when she asks for the &ldquo;delivery address&rdquo; (building, floor, flat number or a nearby landmark), even though your phone also shares GPS.</>,
      <>If you are on the move, Mia guides you turn by turn to the nearest police station or hospital, phrased as directions to &ldquo;meet the rider&rdquo;.</>,
      <>Responders can send you messages through Mia. They sound like delivery updates (&ldquo;your rider is 5 minutes away, please wait inside&rdquo;).</>,
      <>Tap the red button to hang up at any time.</>,
    ],
    tips: [
      'Calls are kept short, usually under 3 minutes, so they never sound unusual. If you are moving or being chased, Mia stays on the line as long as you need.',
      'If you go quiet after danger was mentioned, Mia goes silent too and keeps listening. The line stays open for the response team.',
      'The back camera can share the scene with responders. Nothing is shown on your screen.',
    ],
  },
  {
    id: 'click-order',
    icon: '🛒',
    title: 'Click & order (coded order)',
    tag: "Can't talk, can tap",
    what: <>Some menu items and add-ons carry a hidden meaning. Ordering them sends a decoded alert to responders, while you only see a normal food order.</>,
    when: [
      'You cannot speak, but you can use the screen normally.',
      'Someone may be watching your screen, so it has to look like ordinary shopping.',
    ],
    how: [
      <>Browse the menu and add the item that matches your situation (see the <a href="#codes">code table</a> below).</>,
      <>Not sure what an item means? <b>Press and hold its picture</b> in the item sheet to see its meaning. Ordinary items show nothing.</>,
      <>Set the <b>quantity</b> to the number of people involved.</>,
      <>At checkout, pick the <b>delivery speed</b>: faster means more urgent.</>,
      <>Tap <b>Place order</b>. Your rough location is attached automatically.</>,
      <>You land on a normal &ldquo;order placed&rdquo; screen. Its delivery status quietly follows the responders' progress.</>,
    ],
    tips: ['An order with no coded items is just an ordinary order. No alert is sent.'],
  },
  {
    id: 'delivery-instructions',
    icon: '📝',
    title: 'Delivery instructions (silent report)',
    tag: "Can't make any sound",
    what: <>A silent form that looks like instructions for the delivery rider. It sends a report without any call or sound.</>,
    when: [
      'Making any sound would put you at risk.',
      'You want to add a note or a photo for responders.',
    ],
    how: [
      <>On the home screen, with an empty cart, tap <b>Delivery instructions</b> (under &ldquo;Ordering as guest&rdquo;).</>,
      <>Tap the instruction options that match your situation. <b>Press and hold</b> any option to see what it means.</>,
      <>Add a <b>note for the rider</b> in your own words, and the delivery address.</>,
      <>Optionally <b>add a photo</b>. The AI reads it for useful details, such as a vehicle or a place.</>,
      <>Tap <b>Save instructions</b>. The report is sent and you return to the home screen.</>,
    ],
  },
  {
    id: 'sos',
    icon: '🖤',
    title: 'Heart double-tap SOS',
    tag: "Being held, can't touch the phone",
    what: <>A hidden emergency mode for the worst situations, such as being held against your will. The phone looks switched off while it quietly streams both cameras and the microphone to the response team, and the AI listens and reports what is happening.</>,
    when: [
      'You cannot talk, type, or keep a call screen open.',
      'Someone is controlling you or the situation and the phone must look switched off.',
    ],
    how: [
      <>On the home screen, <b>double-tap the heart icon</b> (top right) quickly. A single tap does nothing unusual.</>,
      <>The screen turns completely black and ignores touches. Leave the phone face-up or in a pocket; it keeps recording.</>,
      <>The AI silently notes captors, weapons, injuries, names, demands and background sounds for responders.</>,
      <>To stop, <b>tap the screen three times quickly</b> (within about 1.5 seconds). You return to the home screen with no trace.</>,
    ],
    tips: [
      "Your phone's own camera/microphone indicator may still appear. The app cannot hide it.",
      'On the Android app the screen can also dim. In a browser it is a black overlay.',
    ],
  },
  {
    id: 'exit',
    icon: '🧹',
    title: 'Zero-trace exit',
    tag: 'Every path',
    what: <>However a report ends, you are returned to the ordinary home screen.</>,
    when: ['Automatically, at the end of every call, coded order, silent report or SOS.'],
    how: [
      <>&ldquo;Report sent&rdquo; and &ldquo;backed out&rdquo; look exactly the same: no confirmation, no pop-up.</>,
      <>The <b>Back</b> button never returns to the call or report screen.</>,
    ],
  },
  {
    id: 'disguise',
    icon: '🎭',
    title: 'Change the app icon and name',
    tag: 'Android app',
    what: <>Make the app blend in with the other apps on your phone.</>,
    when: ['You want the app to look like something other than a food app.'],
    how: [
      <>Tap the <b>account icon</b> (top right) and open <b>App appearance</b>.</>,
      <>Pick an icon and type a new app name, then save. It stays changed after restarts.</>,
    ],
  },
  {
    id: 'demo',
    icon: '🧪',
    title: 'Try a demo call',
    tag: 'Safe to test',
    what: <>A full, real call with Mia that is <b>never sent to responders</b>. At the end you see exactly what a responder would have seen.</>,
    when: ['You want to try QuickBite, practise, or show someone how it works.'],
    how: [
      <><b>Press and hold the QuickBite logo</b> (top left of the home screen) for about 2 seconds.</>,
      <>Have the call as you normally would. A small &ldquo;Demo call&rdquo; label confirms nothing is sent.</>,
      <>When you hang up, a <b>&ldquo;What the responder would see&rdquo;</b> page shows the severity, location, what was understood, and the transcript.</>,
    ],
    tips: ['Limited to 3 demo calls per hour on each device.'],
  },
]

// Quick-pick: the situation the person is in, mapped to what to use. "Free to talk" is the same call as
// "someone may be listening", in open mode (say "talk" at the start), so both point to the call section.
const PICKS = [
  { icon: '🗣️', situation: 'Free to talk, alone and safe to speak', use: 'Call to order, say "talk"', target: 'call' },
  { icon: '📞', situation: 'Can talk, but someone may be listening', use: 'Call to order, say "order"', target: 'call' },
  { icon: '🛒', situation: "Can't talk, can tap", use: 'Click & order', target: 'click-order' },
  { icon: '📝', situation: "Can't make any sound", use: 'Delivery instructions', target: 'delivery-instructions' },
  { icon: '🖤', situation: "Being held, can't touch the phone", use: 'Heart double-tap SOS', target: 'sos' },
]

const CODES: [string, string][] = [
  ['Cheesy Garlic Bread', 'Someone is following or chasing you'],
  ['Family Combo', 'You witnessed a crime'],
  ["Kids' Meal Box", 'A child is in danger'],
  ['Choco Lava Cake', 'Domestic violence'],
  ['Party Platter', 'A group fight'],
  ['Mint Lemonade', 'A hazard (fire, gas, accident)'],
  ['Extra Pepperoni', 'A weapon is involved'],
  ['Extra Spicy', 'You are being harmed right now'],
  ['Extra Cheese', 'You are locked in or confined'],
  ['Extra Napkins', 'Someone is injured'],
  ['Sealed To-Go Box', 'Someone is being taken'],
]

// Client-side navigation inside the manual: /manual is the overview, /manual/<id> one feature per page.
function go(e: ReactMouseEvent, href: string, onNavigate: (path: string) => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  window.history.pushState(null, '', href)
  window.scrollTo({ top: 0 })
  onNavigate(href)
}

const ALL_TABS = [...FEATURES.map((f) => ({ id: f.id, icon: f.icon, title: f.title })), { id: 'codes', icon: '🍕', title: 'Code table' }]

export default function Manual({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const slug = path.replace(/^\/manual\/?/, '').replace(/\/$/, '')
  const feature = FEATURES.find((f) => f.id === slug)
  const current = feature ? feature.id : slug === 'codes' ? 'codes' : null
  const index = ALL_TABS.findIndex((t) => t.id === current)
  const prev = index > 0 ? ALL_TABS[index - 1] : null
  const next = index >= 0 && index < ALL_TABS.length - 1 ? ALL_TABS[index + 1] : null
  const link = (href: string) => ({ href, onClick: (e: ReactMouseEvent) => go(e, href, onNavigate) })

  return (
    <main className="manual">
      <div className="container manual-inner">
        <nav className="manual-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span>›</span>
          {current ? <a {...link('/manual')}>User manual</a> : <span aria-current="page">User manual</span>}
          {current && (
            <>
              <span>›</span>
              <span aria-current="page">{ALL_TABS[index].title}</span>
            </>
          )}
        </nav>

        <div className="manual-tabs" role="tablist" aria-label="Manual sections">
          <a {...link('/manual')} role="tab" aria-selected={!current} className={!current ? 'on' : ''}>📖 Overview</a>
          {ALL_TABS.map((t) => (
            <a key={t.id} {...link(`/manual/${t.id}`)} role="tab" aria-selected={current === t.id} className={current === t.id ? 'on' : ''}>
              {t.icon} {t.title}
            </a>
          ))}
        </div>

        {!current && (
          <>
            <header className="manual-hero">
              <span className="eyebrow">User manual</span>
              <h1>How to use QuickBite</h1>
              <p className="muted">
                Four ways to ask for help, all hidden inside an ordinary food app. Pick whichever is safe right now. Each one has
                its own page: what it is, when to use it, and exactly what to do.
              </p>
            </header>
            <section className="manual-pick">
              <h2>Which one should I use?</h2>
              <div className="manual-pick-grid">
                {PICKS.map((p) => (
                  <a key={p.situation} {...link(`/manual/${p.target}`)} className="manual-pick-card">
                    <span className="manual-icon">{p.icon}</span>
                    <b>{p.situation}</b>
                    <span>→ {p.use}</span>
                  </a>
                ))}
              </div>
            </section>
            <section className="manual-pick">
              <h2>All topics</h2>
              <div className="manual-topics">
                {ALL_TABS.map((t) => {
                  const f = FEATURES.find((x) => x.id === t.id)
                  return (
                    <a key={t.id} {...link(`/manual/${t.id}`)} className="manual-topic">
                      <span className="manual-icon">{t.icon}</span>
                      <span><b>{t.title}</b><small>{f ? f.tag : 'What each coded menu item means'}</small></span>
                      <span className="manual-go">→</span>
                    </a>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {feature && (
          <article className="manual-card">
            <div className="manual-card-head">
              <span className="manual-icon">{feature.icon}</span>
              <div>
                <h1 className="manual-title">{feature.title}</h1>
                <span className="manual-tag">{feature.tag}</span>
              </div>
            </div>
            <div className="manual-cols">
              <div>
                <h3>What it is</h3>
                <p>{feature.what}</p>
                <h3>When to use it</h3>
                <ul>{feature.when.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
              <div>
                <h3>How to use it</h3>
                <ol>{feature.how.map((h, i) => <li key={i}>{h}</li>)}</ol>
                {feature.tips && (
                  <div className="manual-tips">
                    {feature.tips.map((t) => <p key={t}>💡 {t}</p>)}
                  </div>
                )}
              </div>
            </div>
          </article>
        )}

        {current === 'codes' && (
          <article className="manual-card">
            <div className="manual-card-head">
              <span className="manual-icon">🍕</span>
              <div>
                <h1 className="manual-title">Code table</h1>
                <span className="manual-tag">For Click &amp; order</span>
              </div>
            </div>
            <p className="muted">
              On a call you never need this: Mia says each meaning out loud. For a coded order, add the item that matches your
              situation. You can also press and hold an item's picture in the app to check.
            </p>
            <div className="manual-codes">
              {CODES.map(([food, meaning]) => (
                <div key={food}><b>{food}</b><span>{meaning}</span></div>
              ))}
            </div>
          </article>
        )}

        {slug && !current && <p className="muted">That page doesn't exist. Pick a topic above.</p>}

        {current && (
          <div className="manual-pager">
            {prev ? <a {...link(`/manual/${prev.id}`)}>← {prev.icon} {prev.title}</a> : <a {...link('/manual')}>← Overview</a>}
            {next && <a {...link(`/manual/${next.id}`)} className="next">{next.icon} {next.title} →</a>}
          </div>
        )}

        <div className="manual-help">
          <b>In an emergency, if it is safe to do so, call your local emergency number (112 in India).</b> QuickBite supports,
          and does not replace, emergency services.
          <div className="manual-actions">
            <a className="btn btn-primary" href={LINKS.web} target="_blank" rel="noreferrer">Open QuickBite →</a>
            <a className="btn btn-ghost" href="/privacy">Privacy Policy</a>
          </div>
        </div>
      </div>
    </main>
  )
}
