import { useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { LINKS } from './ui'
import { CodeTable, DashboardGuide, TourPage } from './ManualGuides'
import { ManualShot, ShotRow, type ShotName } from './ManualShot'

// User manual (/manual): a guided tour with speakable scripts, the responder dashboard, every way to ask for help
// (What / When / How / On the dashboard) and the code table. Checked against the live app with
// scripts/capture-manual-shots.mjs, which also takes the screenshots.

type Feature = {
  id: string
  icon: string
  title: string
  tag: string
  what: ReactNode
  when: string[]
  how: ReactNode[]
  tips?: ReactNode[]
  dashboard?: ReactNode[]
  shots?: { name: ShotName; caption?: ReactNode }[]
  tryIt?: { href: string; label: string }
}

const FEATURES: Feature[] = [
  {
    id: 'talk-freely',
    icon: '🗣️',
    title: 'Free to talk (open call)',
    tag: 'Alone and safe to speak',
    what: <>The same call, without the disguise. When you can speak freely, Mia drops the food cover and talks to you like a calm emergency dispatcher, in plain words and in your language.</>,
    when: [
      'You are alone, or nobody dangerous can hear you.',
      'You want to explain what is happening in your own words.',
      'You are reporting an emergency you are watching, such as an accident, a fire or a fight.',
    ],
    how: [
      <>Open QuickBite and, with an <b>empty cart</b>, tap <b>Call to order</b> at the bottom of the home screen.</>,
      <>When Mia asks whether you can talk freely, say <b>&ldquo;talk&rdquo;</b>. You can also just start describing the emergency; she switches to open mode straight away.</>,
      <>Answer her direct questions: what is happening, is anyone hurt, are you safe right now and <b>exactly where you are</b>. She asks you to spell names letter by letter and reads them back.</>,
      <>Follow her steps. She gives practical first aid (bleeding, breathing, burns, choking) and safety advice while you wait.</>,
      <>If you need to get away, she guides you turn by turn to the nearest police station or hospital, with the distance left.</>,
      <>She offers to email you the full case report with a reference number. Stay on until she confirms you are safe; the red button hangs up.</>,
    ],
    tips: [
      <>If someone comes near, whisper or say <b>&ldquo;I can't talk&rdquo;</b> or <b>&ldquo;someone's coming&rdquo;</b>: Mia goes back to the food-order disguise.</>,
      'Mia also suggests calling 112 if you can. She stays on the line either way.',
      'Speak in any language, including mixed speech like Manglish or Hinglish. Mia replies in the same one.',
    ],
    dashboard: [
      <>A <b>Voice call</b> appears at the top of the Live queue the moment the call starts.</>,
      <><b>Threat</b>, <b>Subjects</b> and <b>Location</b> fill in as you answer; <b>Voice stress</b> within about 30 seconds.</>,
      <>Mia's first-aid and safety advice is logged as <b>Advice to caller</b> on the timeline.</>,
      <>If you are on the move: <b>Route to safety</b> and the route on the map.</>,
    ],
    shots: [{ name: 'dash-route', caption: 'A recorded open call: the caller was followed and guided to the police station.' }],
    tryIt: { href: '/manual/tour#script-b', label: 'Script B: open call, someone is following you' },
  },
  {
    id: 'call',
    icon: '📞',
    title: 'Call to order (disguised)',
    tag: 'Can talk, but someone may be listening',
    what: <>A phone call to the &ldquo;QuickBite Order Desk&rdquo; that sounds like an ordinary food order. Mia, an AI assistant, asks food questions that secretly mean something, and everything you answer goes straight to a response team as a live emergency report.</>,
    when: [
      'You can speak, but someone nearby might hear you.',
      'You are being followed, threatened or watched, and the call must sound normal.',
      'You want to report something happening to someone else without anyone noticing.',
    ],
    how: [
      <>With an <b>empty cart</b>, tap <b>Call to order</b> and allow the microphone. The screen shows <b>QuickBite Order Desk</b> and a timer.</>,
      <>When Mia asks whether you can talk freely, say <b>&ldquo;order&rdquo;</b>.</>,
      <>Mia offers food choices and says what each one really means in the same sentence (e.g. &ldquo;garlic bread means someone is following or chasing you&rdquo;). Answer with just the food word. You never need to remember any codes.</>,
      <>Her follow-ups are coded too: how many pizzas = how many people, &ldquo;hand it to you&rdquo; = the person is still with you, and so on (<a href="/manual/codes#call-codes">all of them</a>).</>,
      <>For the &ldquo;delivery address&rdquo;, give the house name or number, area and town, and <b>spell them letter by letter</b> when she asks. She reads it back; say &ldquo;yes&rdquo; when it is right.</>,
      <>If you are on the move, she guides you to the nearest police station, phrased as directions to where &ldquo;the rider is waiting&rdquo;.</>,
      <>Responders can send you messages through Mia. They sound like delivery updates (&ldquo;your rider is about 5 minutes away, please wait inside&rdquo;).</>,
      <>She may offer to email the &ldquo;order receipt&rdquo;: that is your case report. Tap the red button to hang up at any time.</>,
    ],
    tips: [
      'Calls are kept to about 3 minutes, so they never sound unusual. If you are being chased, Mia stays on as long as you need.',
      'If you go quiet after danger was mentioned, Mia goes quiet too and keeps listening. The line stays open for the response team.',
      'The back camera can share the scene with responders. Nothing is shown on your screen.',
    ],
    dashboard: [
      <>A <b>Voice call</b> at the top of the Live queue as soon as the call starts, with a rough location.</>,
      <>Each coded answer becomes a danger tag in <b>Threat</b> (severity rises, <b>AI recommends</b> updates), often before your words show in the transcript.</>,
      <>In <b>Conversation</b>, the food words are struck through with their real meaning.</>,
      <>The spelled address becomes the <b>Location</b> and a map pin, with <b>Nearby help</b>.</>,
      <>After the call: the AI case summary, dispatch bulletin and recordings in <b>Case file</b>.</>,
    ],
    shots: [
      { name: 'qb-call', caption: 'The call screen: no sign of an emergency.' },
      { name: 'dash-conversation', caption: 'What the responder reads, decoded.' },
    ],
    tryIt: { href: '/manual/tour#script-a', label: 'Script A: covert call, someone threatening you is in the room' },
  },
  {
    id: 'click-order',
    icon: '🛒',
    title: 'Click & order (coded order)',
    tag: "Can't talk, can tap",
    what: <>Some menu items carry a hidden meaning. Ordering them sends a decoded alert to responders, while the screen only shows a normal food order.</>,
    when: [
      'You cannot speak, but you can use the screen normally.',
      'Someone may be watching your screen, so it has to look like ordinary shopping.',
    ],
    how: [
      <>With an empty cart, add the item that matches your situation (see the <a href="/manual/codes">code table</a>). Coded dishes are in their usual sections; the five coded extras are under the <b>Add-ons</b> chip.</>,
      <>Not sure what an item means? Tap it, then <b>press and hold its picture</b>: the meaning appears under it. Ordinary items show nothing.</>,
      <>Set the <b>quantity</b> to the number of people involved.</>,
      <>At checkout, under <b>Delivery time</b>, choose <b>As soon as possible</b> if it is urgent (it can only raise the urgency).</>,
      <>Tap <b>Place order</b>. Your phone's rough location is attached automatically.</>,
      <>You see a normal <b>Order placed!</b> screen. Its <b>Order status</b> quietly follows the responders: Rider assigned → On the way → Delivered.</>,
    ],
    tips: [
      'An order with no coded items is just an ordinary order. Nothing is sent.',
      'More coded foods can be added later: one entry in the shared code list plus the dish on the menu.',
    ],
    dashboard: [
      <>A <b>Coded order</b> appears when you tap Place order: the meanings in <b>Threat</b>, the quantity in <b>Subjects</b>, usually <b>HIGH</b>.</>,
      <>Location is your rough position. There is no audio.</>,
      <>It stays Live until a responder resolves it; Acknowledge / Start response / Resolve change the phone's order status.</>,
    ],
    shots: [
      { name: 'qb-addons', caption: 'Coded extras sit among ordinary add-ons.' },
      { name: 'qb-item-meaning' },
      { name: 'qb-checkout', caption: 'Delivery time doubles as urgency.' },
      { name: 'dash-coded-order', caption: 'The decoded cart on the dashboard.' },
    ],
    tryIt: { href: '/manual/tour#recipe-order', label: 'Click & order, step by step' },
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
      <>On the home screen, with an empty cart, tap <b>Delivery instructions</b> (under &ldquo;Ordering as guest&rdquo;). The report starts as soon as this screen opens.</>,
      <>Under <b>Any special instructions?</b> tap the options that match. <b>Press and hold</b> one to read its meaning (letting go also selects it; tap again to unselect). Each tap is sent straight away.</>,
      <>Under <b>Delivery address</b>, type where you are.</>,
      <>Optionally, under <b>Add a photo</b>, tap <b>Choose a photo</b>. The AI reads it for useful details, such as a vehicle, people or a sign.</>,
      <>Under <b>Note for rider</b>, add anything else in your own words.</>,
      <>Tap <b>Save instructions</b>. You are back on the home screen, with no confirmation.</>,
    ],
    tips: ['Because every tap is sent at once, even a half-finished report reaches responders.'],
    dashboard: [
      <>A <b>Silent tap</b> case appears as soon as the screen opens.</>,
      <>Each option you tap appears in <b>Threat</b> straight away (&ldquo;Don't ring, leave silently&rdquo; = weapon, HIGH).</>,
      <>A photo adds what the AI saw to <b>Seen &amp; heard</b>; after Save, the address is placed on the map.</>,
    ],
    shots: [{ name: 'qb-instructions-hold', caption: 'Holding an option shows its meaning.' }],
    tryIt: { href: '/manual/tour#recipe-instructions', label: 'Delivery instructions, step by step' },
  },
  {
    id: 'sos',
    icon: '🖤',
    title: 'Heart double-tap SOS',
    tag: "Being held, can't touch the phone",
    what: <>A hidden emergency mode for the worst situations, such as being held against your will. The phone looks switched off while it quietly streams the cameras and the microphone to the response team, and the AI listens and reports what is happening.</>,
    when: [
      'You cannot talk, type, or keep a call screen open.',
      'Someone is controlling you or the situation and the phone must look switched off.',
    ],
    how: [
      <>On the home screen, <b>double-tap the heart icon</b> (top right) quickly. A single tap does nothing unusual.</>,
      <>The screen turns completely black and ignores touches. Leave the phone face-up or in a pocket; it keeps recording.</>,
      <>The AI silently notes captors, weapons, injuries, names, demands and background sounds for responders.</>,
      <>To stop, <b>tap anywhere on the black screen three times quickly</b>. You return to the home screen with no trace.</>,
    ],
    tips: [
      'Allow the camera and microphone once beforehand, so no permission box appears over the black screen when it matters.',
      "Your phone's own camera/microphone indicator may still appear. The app cannot hide it.",
      'In a browser it is a black overlay (the address bar may stay visible). The Android app also dims the screen.',
    ],
    dashboard: [
      <>A <b>Silent SOS</b> with the <b>SOS · HOSTAGE</b> badge, <b>HIGH</b> at once.</>,
      <>Live camera video (Back/Front switch) and <b>Listen</b> for live audio; Conversation shows what the microphone hears.</>,
      <>The silent AI fills in Threat, Subjects and Seen &amp; heard; after the exit, the summary, bulletin and camera recordings.</>,
    ],
    tryIt: { href: '/manual/tour#recipe-sos', label: 'Heart SOS, step by step' },
  },
  {
    id: 'exit',
    icon: '🧹',
    title: 'Zero-trace exit',
    tag: 'Every path',
    what: <>However a report ends, nothing on the screen gives it away.</>,
    when: ['Automatically, at the end of every call, coded order, silent report or SOS.'],
    how: [
      <>Calls, silent reports and the SOS end on the ordinary home screen. A coded order ends on a normal &ldquo;Order placed!&rdquo; screen.</>,
      <>&ldquo;Report sent&rdquo; and &ldquo;backed out&rdquo; look exactly the same: no confirmation, no pop-up.</>,
      <>Once a report has ended, the <b>Back</b> button never returns to it.</>,
    ],
    tips: ["Hang up with the red button: leaving a call with the browser's Back button keeps it running in the background."],
  },
  {
    id: 'disguise',
    icon: '🎭',
    title: 'Change the app icon and name',
    tag: 'Android app only',
    what: <>Make the app blend in with the other apps on your phone.</>,
    when: ['You want the app to look like something other than a food app.'],
    how: [
      <>In the Android app, tap the <b>account icon</b> (top right) and open <b>App appearance</b>.</>,
      <>Pick an icon and type a new app name, then save. It stays changed after restarts.</>,
    ],
    tips: ["The web app doesn't have this: its account page only holds your mobile number and trusted contacts."],
  },
]

// Quick-pick: the situation the person is in, mapped to what to use.
const PICKS = [
  { icon: '🗣️', situation: 'Free to talk, alone and safe to speak', use: 'Free to talk (open call)', target: 'talk-freely' },
  { icon: '📞', situation: 'Can talk, but someone may be listening', use: 'Call to order (disguised)', target: 'call' },
  { icon: '🛒', situation: "Can't talk, can tap", use: 'Click & order', target: 'click-order' },
  { icon: '📝', situation: "Can't make any sound", use: 'Delivery instructions', target: 'delivery-instructions' },
  { icon: '🖤', situation: "Being held, can't touch the phone", use: 'Heart double-tap SOS', target: 'sos' },
]

type Tab = { id: string; icon: string; title: string; tag: string }
const GROUPS: { title: string; tabs: Tab[] }[] = [
  {
    title: 'Start here',
    tabs: [
      { id: 'tour', icon: '🧭', title: 'Guided tour & scripts', tag: 'Try every feature in 15 minutes, with what to say' },
      { id: 'dashboard', icon: '🖥️', title: 'Responder dashboard', tag: 'Where each piece of information shows up' },
    ],
  },
  { title: 'Ways to ask for help', tabs: FEATURES.map((f) => ({ id: f.id, icon: f.icon, title: f.title, tag: f.tag })) },
  { title: 'Reference', tabs: [{ id: 'codes', icon: '🍕', title: 'Code table', tag: 'Every coded item and what it means' }] },
]
const ALL_TABS = GROUPS.flatMap((g) => g.tabs)

// Client-side navigation inside the manual: /manual is the overview, /manual/<id> one page each, #section to jump.
function go(e: ReactMouseEvent, href: string, onNavigate: (path: string) => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  const [path, hash] = href.split('#')
  window.history.pushState(null, '', href)
  onNavigate(path)
  if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 60)
  else window.scrollTo({ top: 0 })
}

// What the app needs permission for, and how to allow it. Fully open on the overview and the tour; one line that
// opens on the other pages. Callers who never saw the browser's permission box couldn't start a call.
const PERMISSIONS = [
  { icon: '🎙️', name: 'Microphone', need: 'Required', why: 'to talk to the order desk on a call' },
  { icon: '📷', name: 'Camera', need: 'Recommended', why: 'so responders can see what is happening (calls still work without it)' },
  { icon: '📍', name: 'Location', need: 'Recommended', why: 'for your live position and directions to the nearest help' },
  { icon: '📳', name: 'Motion sensors', need: 'iPhone asks', why: 'to notice if the phone is grabbed, dropped or you are running' },
]

function PermissionsNotice({ compact }: { compact?: boolean }) {
  const body = (
    <>
      <ul className="manual-permissions-list">
        {PERMISSIONS.map((x) => (
          <li key={x.name}>
            <span aria-hidden="true">{x.icon}</span>
            <span><b>{x.name}</b> <em className={x.need === 'Required' ? 'req' : ''}>{x.need}</em><br />{x.why}</span>
          </li>
        ))}
      </ul>
      <div className="manual-permissions-help">
        <p><b>No permission box appeared?</b></p>
        <ul>
          <li>Open the link in <b>Chrome</b> (Android) or <b>Safari</b> (iPhone), not inside WhatsApp, Instagram or Facebook.</li>
          <li><b>Android:</b> tap the icon left of the web address → Permissions → allow Microphone, Camera and Location. Still blocked? Phone Settings → Apps → Chrome → Permissions.</li>
          <li><b>iPhone:</b> Safari → tap “aA” → Website Settings → Allow. Chrome on iPhone: Settings app → Chrome → turn on Microphone, Camera and Location.</li>
          <li>Then reload the page and tap “Call to order” again.</li>
        </ul>
      </div>
    </>
  )
  if (compact) {
    return (
      <details className="manual-permissions compact">
        <summary>⚠️ <b>Before you start:</b> allow the <b>microphone</b> (required), camera and location when the browser asks. <span>How?</span></summary>
        {body}
      </details>
    )
  }
  return (
    <section className="manual-permissions" role="note" aria-label="Permissions you must allow">
      <div className="manual-permissions-head">
        <span aria-hidden="true">⚠️</span>
        <div>
          <b>Before you start: allow these permissions</b>
          <p>When the browser asks, tap <b>Allow</b>. Without the microphone, a call cannot connect.</p>
        </div>
      </div>
      {body}
    </section>
  )
}

function FeaturePage({ feature, link }: { feature: Feature; link: (href: string) => { href: string; onClick: (e: ReactMouseEvent) => void } }) {
  return (
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
          {feature.tryIt && (
            <a {...link(feature.tryIt.href)} className="manual-try">▶ Try it: {feature.tryIt.label}</a>
          )}
        </div>
        <div>
          <h3>How to use it</h3>
          <ol>{feature.how.map((h, i) => <li key={i}>{h}</li>)}</ol>
          {feature.tips && (
            <div className="manual-tips">
              {feature.tips.map((t, i) => <p key={i}>💡 {t}</p>)}
            </div>
          )}
        </div>
      </div>
      {feature.dashboard && (
        <div className="manual-dash">
          <h3>🖥️ On the responder dashboard</h3>
          <ul>{feature.dashboard.map((d, i) => <li key={i}>{d}</li>)}</ul>
          <a {...link('/manual/dashboard')}>How the dashboard works →</a>
        </div>
      )}
      {feature.shots && (
        <ShotRow>
          {feature.shots.map((s) => <ManualShot key={s.name} name={s.name} caption={s.caption} />)}
        </ShotRow>
      )}
    </article>
  )
}

export default function Manual({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const slug = path.replace(/^\/manual\/?/, '').replace(/\/$/, '')
  const feature = FEATURES.find((f) => f.id === slug)
  const current = ALL_TABS.some((t) => t.id === slug) ? slug : null
  const index = ALL_TABS.findIndex((t) => t.id === current)
  const prev = index > 0 ? ALL_TABS[index - 1] : null
  const next = index >= 0 && index < ALL_TABS.length - 1 ? ALL_TABS[index + 1] : null
  const link = (href: string) => ({ href, onClick: (e: ReactMouseEvent) => go(e, href, onNavigate) })

  // Plain <a href="/manual/…"> inside the content (e.g. in the feature text) also navigate without a reload.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      const href = a?.getAttribute('href')
      if (!a || !href?.startsWith('/manual') || a.target || e.defaultPrevented) return
      go(e as unknown as ReactMouseEvent, href, onNavigate)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [onNavigate])

  // Closes the phone dropdown after picking a topic.
  const pick = (e: ReactMouseEvent) => (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')
  const SideLinks = () => (
    <nav className="manual-side-links">
      <a {...link('/manual')} className={!current ? 'on' : ''} onClickCapture={pick}>📖 Overview</a>
      {GROUPS.map((g) => (
        <div key={g.title} className="manual-side-group">
          <span className="manual-side-heading">{g.title}</span>
          {g.tabs.map((t) => (
            <a key={t.id} {...link(`/manual/${t.id}`)} className={current === t.id ? 'on' : ''} onClickCapture={pick}>
              <span>{t.icon}</span> {t.title}
            </a>
          ))}
        </div>
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
                QuickBite looks like an ordinary food-delivery app. Behind it, an AI assistant called Mia turns a food
                order into a live emergency report for a response team. Every way in has its own page: what it is, when to
                use it, exactly what to do, and what the responders see.
              </p>
            </header>
            <a {...link('/manual/tour')} className="manual-start">
              <span className="manual-icon">🧭</span>
              <span>
                <b>New here? Take the guided tour</b>
                <small>Try every feature on your phone in about 15 minutes, with a script of what to say and where to look on the responder dashboard (test login included).</small>
              </span>
              <span className="manual-go">→</span>
            </a>
            <PermissionsNotice />
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
            <ShotRow>
              <ManualShot name="qb-home" caption="Where everything starts. The numbered controls are explained on each page." />
            </ShotRow>
            {GROUPS.map((g) => (
              <section key={g.title} className="manual-pick">
                <h2>{g.title}</h2>
                <div className="manual-topics">
                  {g.tabs.map((t) => (
                    <a key={t.id} {...link(`/manual/${t.id}`)} className="manual-topic">
                      <span className="manual-icon">{t.icon}</span>
                      <span><b>{t.title}</b><small>{t.tag}</small></span>
                      <span className="manual-go">→</span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        {current && <PermissionsNotice compact={current !== 'tour'} />}

        {feature && <FeaturePage feature={feature} link={link} />}
        {current === 'tour' && <TourPage link={link} />}
        {current === 'dashboard' && <DashboardGuide link={link} />}
        {current === 'codes' && <CodeTable />}

        {slug && !current && <p className="muted">That page doesn't exist. Pick a topic from the list.</p>}

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
