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
    id: 'talk-freely',
    icon: '🗣️',
    title: 'Free to talk (open call)',
    tag: 'Alone and safe to speak',
    what: <>The same order call, but with no disguise. When you can speak freely, Mia drops the food cover and talks to you like a calm emergency dispatcher, in plain words and in your language.</>,
    when: [
      'You are alone, or nobody dangerous can hear you.',
      'You want to explain what is happening in your own words.',
      'You are reporting an emergency you are watching, such as an accident, a fire or a fight.',
    ],
    how: [
      <>Open QuickBite and, with an <b>empty cart</b>, tap <b>Call to order</b> at the bottom of the home screen.</>,
      <>When Mia asks whether you can talk freely, say <b>&ldquo;talk&rdquo;</b>. You can also just start describing the emergency; she switches to open mode straight away.</>,
      <>Answer her direct questions: is anyone hurt, are you safe right now, <b>exactly where you are</b> (area, road, town or a landmark), how many people, any weapon, which vehicle.</>,
      <>Follow her instructions step by step. She gives practical first aid (bleeding, breathing, burns, choking) and safety advice while you wait.</>,
      <>If you need to get away, she guides you turn by turn to the nearest police station or hospital, with the distance left.</>,
      <>Stay on the line until she confirms you are safe. Tap the red button to hang up at any time.</>,
    ],
    tips: [
      'If someone comes near or you need to whisper, just answer with food words: Mia switches back to the disguise at once.',
      'Mia also reminds you to call 112 if you can. She stays on the line with you either way.',
      'Speak in any language, including mixed speech like Manglish or Hinglish. Mia replies in the same one.',
    ],
  },
  {
    id: 'call',
    icon: '📞',
    title: 'Call to order (disguised)',
    tag: 'Can talk, but someone may be listening',
    what: <>A phone call to the &ldquo;QuickBite order desk&rdquo; that sounds like an ordinary food order. Mia, an AI assistant, asks food questions that secretly mean something, and everything you answer goes straight to a response team as a live emergency report.</>,
    when: [
      'You can speak, but someone nearby might hear you.',
      'You are being followed, threatened, or watched and the call must sound normal.',
      'You want to report something happening to someone else without anyone noticing.',
    ],
    how: [
      <>Open QuickBite and, with an <b>empty cart</b>, tap <b>Call to order</b> at the bottom of the home screen.</>,
      <>When Mia asks whether you can talk freely, say <b>&ldquo;order&rdquo;</b>.</>,
      <>Mia offers food choices and says what each one really means in the same sentence (e.g. &ldquo;garlic bread means someone is following you&rdquo;). Just repeat the food word and a number. You never need to remember any codes.</>,
      <>Give your <b>exact location</b> when she asks for the &ldquo;delivery address&rdquo; (building, floor, flat number or a nearby landmark), even though your phone also shares GPS.</>,
      <>If you are on the move, Mia guides you to the nearest police station or hospital, phrased as directions to &ldquo;meet the rider&rdquo;.</>,
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
// "someone may be listening" in open mode, but each has its own page because what to do is different.
const PICKS = [
  { icon: '🗣️', situation: 'Free to talk, alone and safe to speak', use: 'Free to talk (open call)', target: 'talk-freely' },
  { icon: '📞', situation: 'Can talk, but someone may be listening', use: 'Call to order (disguised)', target: 'call' },
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

  // Closes the phone dropdown after picking a topic.
  const pick = (e: ReactMouseEvent) => (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')
  const SideLinks = () => (
    <nav className="manual-side-links">
      <a {...link('/manual')} className={!current ? 'on' : ''} onClickCapture={pick}>📖 Overview</a>
      {ALL_TABS.map((t) => (
        <a key={t.id} {...link(`/manual/${t.id}`)} className={current === t.id ? 'on' : ''} onClickCapture={pick}>
          <span>{t.icon}</span> {t.title}
        </a>
      ))}
    </nav>
  )

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

        <div className="manual-layout">
          <aside className="manual-side" aria-label="Manual topics">
            <details className="manual-side-menu" open={false}>
              <summary>
                <span>Topics</span>
                <b>{current ? `${ALL_TABS[index].icon} ${ALL_TABS[index].title}` : '📖 Overview'}</b>
              </summary>
              <SideLinks />
            </details>
            <div className="manual-side-list">
              <SideLinks />
            </div>
          </aside>
          <div className="manual-content">

        {!current && (
          <>
            <header className="manual-hero">
              <span className="eyebrow">User manual</span>
              <h1>How to use QuickBite</h1>
              <p className="muted">
                Every way to ask for help, all inside an ordinary food app. Pick whichever is safe right now. Each one has
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

          </div>
        </div>

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
