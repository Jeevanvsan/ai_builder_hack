import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { ALL_CODES } from '../../../shared/codes.ts'
// The code table is built from the app's own data: the same code list Mia, the checkout and the dashboard use, and
// the real menu (names, sections, photos), so it can't drift from the app. menu.ts is plain data + food photos; if
// it ever starts importing app code, copy the few fields needed here instead.
import { CATEGORIES, MENU } from '../../../web/src/data/menu.ts'
import { LINKS } from './ui'
import { ManualShot, ShotRow } from './ManualShot'

type LinkProps = (href: string) => { href: string; onClick: (e: ReactMouseEvent) => void }

export const DASHBOARD_URL = 'https://quickbite-5cde0-dashboard.web.app'
const TEST_LOGIN = { email: 'judge@quickbite.com', password: 'judge@Quickbite123' }
// A shared public inbox for the emailed case report, so nobody has to give a personal address.
const INBOX = 'qbtour@yopmail.com'
const INBOX_URL = 'https://yopmail.com/?qbtour'
const RECORDED = { covert: 'INC-MUZNKM7N', chase: 'INC-MUZKKVL1' }
const qr = (name: string) => `/shots/manual/${name}.svg?v=${__BUILD_ID__}`

/** A value with a Copy button; "Copied" shows inline (no browser dialog). */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: the value is plain text, so it can still be selected by hand.
    }
  }
  return (
    <div className="manual-copy">
      <span className="manual-copy-label">{label}</span>
      <code>{value}</code>
      <button type="button" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy'}</button>
    </div>
  )
}

/** A link for the phone, with a QR code to scan from the laptop screen. */
function PhoneLink({ qrName, href, children }: { qrName: string; href: string; children: ReactNode }) {
  return (
    <div className="manual-qr">
      <img src={qr(qrName)} alt={`QR code for ${href}`} width={112} height={112} loading="lazy" />
      <div>
        {children}
        <a href={href} target="_blank" rel="noreferrer" className="manual-qr-url">{href.replace('https://', '')}</a>
      </div>
    </div>
  )
}

type Cue = { mia: ReactNode; say: ReactNode; dash?: ReactNode; optional?: boolean }
/** "When Mia asks… / You say… / On the dashboard" rows. Mia's line is quoted with its meaning, as she says it. */
function Cues({ rows }: { rows: Cue[] }) {
  return (
    <div className="manual-cues">
      <div className="manual-cue manual-cue-head" aria-hidden="true">
        <span>When Mia asks…</span>
        <span>You say…</span>
        <span>On the dashboard</span>
      </div>
      {rows.map((r, i) => (
        <div className={`manual-cue${r.optional ? ' is-optional' : ''}`} key={i}>
          <span data-label="Mia asks"><q>{r.mia}</q>{r.optional && <em> only if she asks</em>}</span>
          <span data-label="You say"><b>{r.say}</b></span>
          <span data-label="Dashboard">{r.dash ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ id, title, time, children }: { id: string; title: string; time?: string; children: ReactNode }) {
  return (
    <section id={id} className="manual-card manual-section">
      <h2>{title}{time && <span className="manual-time">{time}</span>}</h2>
      {children}
    </section>
  )
}

export function TourPage({ link }: { link: LinkProps }) {
  return (
    <>
      <header className="manual-card-head manual-page-head">
        <span className="manual-icon">🧭</span>
        <div>
          <h1 className="manual-title">Guided tour &amp; scripts</h1>
          <span className="manual-tag">About 15 minutes · a phone and a laptop</span>
        </div>
      </header>
      <p className="manual-lead">
        Try every way of asking for help on your own phone, and watch each one arrive on the responder dashboard as it
        happens. Keep this page open on the laptop next to the dashboard: switching apps on the phone during a call
        can stop its microphone.
      </p>

      <Section id="setup" title="1. Set up" time="2 min">
        <div className="manual-setup">
          <div>
            <h3>On the laptop: the responder dashboard</h3>
            <CopyField label="Dashboard" value={DASHBOARD_URL} />
            <CopyField label="Email" value={TEST_LOGIN.email} />
            <CopyField label="Password" value={TEST_LOGIN.password} />
            <p>
              Sign in and stay on <b>Live queue</b>. Click anywhere on the page once so the alert sound can play.
              Please don't change the responder list.
            </p>
            <a className="btn btn-primary" href={DASHBOARD_URL} target="_blank" rel="noreferrer">Open the dashboard →</a>
          </div>
          <div>
            <h3>On the phone: QuickBite</h3>
            <PhoneLink qrName="qr-quickbite" href={LINKS.web}>
              <p>Scan with the phone camera, or open the link in <b>Chrome</b> (Android) or <b>Safari</b> (iPhone).</p>
            </PhoneLink>
            <p>
              When the browser asks, <b>allow the microphone</b> (required). Camera and location are recommended.
              Calls are recorded for the responders, and the SOS uses both cameras where the phone allows.
            </p>
          </div>
        </div>
        <ShotRow>
          <ManualShot name="qb-home" caption="Everything starts on this ordinary food-delivery home screen." />
        </ShotRow>
      </Section>

      <Section id="five-minutes" title="Only 5 minutes?" >
        <ol>
          <li>Sign in to the dashboard on the laptop (above).</li>
          <li>Open QuickBite on the phone and do <a {...link('/manual/tour#script-a')}>Script A</a>, the covert call.</li>
          <li>Watch the call fill in live, then open its <b>Case file</b> tab for the AI case summary.</li>
        </ol>
        <p className="muted">
          No phone at hand? Open the two recorded calls after signing in:{' '}
          <a href={`${DASHBOARD_URL}/incident/${RECORDED.covert}`} target="_blank" rel="noreferrer">covert call ({RECORDED.covert})</a> and{' '}
          <a href={`${DASHBOARD_URL}/incident/${RECORDED.chase}`} target="_blank" rel="noreferrer">chase, guided to safety ({RECORDED.chase})</a>, or watch the{' '}
          <a href="/#demo">demo videos</a>.
        </p>
      </Section>

      <Section id="script-a" title="2. Script A: covert call, someone threatening you is in the room" time="3 min">
        <p>
          <b>The story:</b> someone who is hurting or threatening you is in the same room and can hear you, so the call has
          to sound like a food order. You can't leave. The address is a sample one, so you don't share your own.
        </p>
        <ol>
          <li>On the phone, with an empty cart, tap <b>Call to order</b>. The screen shows <b>QuickBite Order Desk</b> and a timer.</li>
          <li>Answer Mia with the food words below. She won't ask every question; answer whichever she asks. If she offers
            different food, pick the one whose meaning fits the story. Use only food words: plain words make her switch to an
            open emergency call.</li>
          <li>On the laptop, open the new <b>Voice call</b> at the top of the Live queue (orange <b>New</b> mark) and watch.</li>
        </ol>
        <Cues
          rows={[
            {
              mia: <>Can you talk freely, or shall we keep it like a normal food order? Just say 'talk' if you can speak freely, or 'order' if someone might be listening.</>,
              say: '"Order, please."',
              dash: <>The call is in the Live queue the moment it starts: <b>● LIVE</b> timer and a rough location on the map.</>,
            },
            {
              mia: <>Is this order for yourself, or for someone else? For yourself means you are the one in trouble…</>,
              say: '"For myself."',
            },
            {
              mia: <>Would you like extra spicy, extra pepperoni, or garlic bread on the side? Extra spicy means someone is hurting or threatening you right now, extra pepperoni means someone near you has a weapon…</>,
              say: '"Extra spicy."',
              dash: <><b>Threat</b> fills in (e.g. "Someone hurting or threatening caller"), severity turns <b>HIGH</b> and <b>AI recommends</b> a dispatch. In <b>Conversation</b>, "extra spicy" is struck through with a red <b>VICTIM BEING HARMED NOW</b> tag.</>,
            },
            {
              mia: <>How many pizzas — one, two, or a few? That's how many people are involved.</>,
              say: '"Just one."',
              dash: <>The number of people (Subjects tile or the bulletin after the call).</>,
            },
            {
              mia: <>Should the rider hand it to you, or leave it at the door? Hand it to you means the person is still right there with you…</>,
              say: '"Hand it to me."',
              dash: <>The attacker is recorded as still present.</>,
            },
            {
              mia: <>Will you collect it outside, or should the rider bring it in? … bring it in means you can't leave or it isn't safe to try.</>,
              say: '"Bring it in."',
              dash: <>No directions; Mia gives stay-safe advice instead (<b>Advice to caller</b> on the timeline).</>,
              optional: true,
            },
            {
              mia: <>A few napkins or a whole pack? A few means a small injury…</>,
              say: '"A few napkins."',
              dash: <>An injury tag in Threat.</>,
              optional: true,
            },
            {
              mia: <>And the delivery address, so the rider finds you? Please spell the house name and area for me.</>,
              say: <>"House number two, three, two. Near Vazhicherry market. V, A, Z, H, I, C, H, E, R, R, Y. Alappuzha."</>,
              dash: <><b>Location</b> shows the address, a pin appears and <b>Nearby help</b> lists the nearest police, hospital and fire station.</>,
            },
            {
              mia: <>So that's House Number 232, Vazhicherry — V, A, Z, H, I, C, H, E, R, R, Y — is that right?</>,
              say: '"Yes, that\'s right."',
            },
            {
              mia: <>Shall I email you the order receipt? Can you spell the email for me, letter by letter?</>,
              say: <>"q, b, t, o, u, r, at, y, o, p, m, a, i, l, dot, com" — then listen to her read-back and say <b>"No"</b> and spell it again if it's wrong. Or say "No, thanks."</>,
              dash: <><b>Case file → Case report email</b>. The PDF case report goes to the shared inbox <a href={INBOX_URL} target="_blank" rel="noreferrer">{INBOX}</a>.</>,
            },
            {
              mia: <>Perfect, your order's on its way. Thanks for calling QuickBite, take care!</>,
              say: <>Nothing: Mia ends the call. (To hang up yourself, use the red button.)</>,
              dash: <>The hub says <b>Case record</b>; within a minute or two the <b>Case file</b> shows the AI summary, the dispatch bulletin and the recordings.</>,
            },
          ]}
        />
        <div className="manual-tips">
          <p>💡 <b>Voice stress</b> shows a 0–100 score within about 30 seconds of you speaking, then updates about every 25 seconds.</p>
          <p>💡 <b>Try it while the call is live:</b> on the dashboard open <b>Message caller</b> and click <b>"Help is about 5 minutes away"</b>. Mia passes it on as delivery chat ("your rider is about 5 minutes away, please wait inside…") and the tab shows <b>✓ Delivered</b>.</p>
          <p>💡 If someone near you says <b>"Who are you talking to?"</b>, Mia notices the second voice: Threat shows <b>Possible coercion: second voice</b>, Seen &amp; heard quotes it, and the Scene tab notes the caller may not be speaking freely.</p>
          <p>💡 Danger tags often reach the dashboard a few seconds <i>before</i> your words appear in the conversation: Mia reports what she understood immediately.</p>
          <p>💡 Linked cases may list other people's test calls at the same sample address. That's expected.</p>
        </div>
        <ShotRow>
          <ManualShot name="qb-call" caption="The call screen on the phone. Nothing on it gives the call away." />
          <ManualShot name="dash-conversation" caption="On the dashboard, each coded answer decodes itself." />
        </ShotRow>
      </Section>

      <Section id="script-b" title="3. Script B: open call, someone is following you" time="3 min">
        <p>
          <b>The story:</b> you're on foot and a man on a black motorbike is chasing you. You can speak freely, so Mia drops
          the disguise and guides you turn by turn to the nearest police station.
        </p>
        <p className="muted">
          The route starts from your phone's real position (it needs location access and GPS; outdoors works best) and goes
          to the police station nearest to you. At a desk the position won't move; walk a few steps to see it follow you.
          On a laptop, Mia asks where you are and routes from there. Prefer not to share your location? Open the recorded
          chase call instead.
        </p>
        <Cues
          rows={[
            { mia: <>Can you talk freely, or shall we keep it like a normal food order? Just say 'talk' if you can speak freely…</>, say: '"Talk."' },
            {
              mia: <>Okay, I'm Mia, I'm with you and passing everything to the response team right now. Tell me what's happening.</>,
              say: '"A man on a black motorbike is chasing me. I\'m on foot."',
              dash: <>Threat: <b>Being chased</b>, Vehicle: <b>Attacker on motorbike</b>, severity HIGH. <b>Route to safety</b> appears with the police station, distance, time and the next turn, and the route is drawn on the map.</>,
            },
            {
              mia: <>Head towards …; the police station is about six hundred metres away… Can you tell me any landmark near you right now, and which way you are heading?</>,
              say: <>Name something you can see and your direction, e.g. "I'm near the bus stop, heading towards the main road." Then confirm each turn: "Okay, turning left."</>,
              dash: <>Location says <b>Moving — live position on the map</b>; Mia's calming and safety advice appears as <b>Advice to caller</b> on the timeline.</>,
            },
            {
              mia: <>You're doing everything right, just keep moving… the police station is about … metres away. Stay with me.</>,
              say: '"He\'s still behind me." … "I see the station. I\'m safe now."',
              dash: <>Threat adds <b>Caller confirmed safe at police station</b>; urgency drops.</>,
            },
            {
              mia: <>Thank goodness you're safe! Can I take an email address? Please spell it letter by letter. I'll send you the full case report with a reference number you can show the police.</>,
              say: <>Spell <b>{INBOX}</b> as in Script A and confirm the read-back, or "No, thanks."</>,
              dash: <><b>Case file → Case report email</b>.</>,
            },
            {
              mia: <>Perfect, your order's on its way. Thanks for calling QuickBite, take care!</>,
              say: <>Nothing: Mia ends the call.</>,
              dash: <>Case file: AI summary, bulletin and recordings.</>,
            },
          ]}
        />
        <div className="manual-tips">
          <p>💡 Say early that you are <b>on foot</b> (or driving): Mia's directions follow what you tell her.</p>
          <p>💡 Mia only gives directions to a caller who is moving (followed, chased or leaving); someone hiding indoors gets stay-safe advice instead.</p>
        </div>
        <ShotRow wide>
          <ManualShot name="dash-route" caption={<>The recorded chase call ({RECORDED.chase}): the route to the police station chosen by AI, and the caller's position.</>} />
        </ShotRow>
      </Section>

      <Section id="recipe-order" title="4. Click & order: a coded cart" time="2 min">
        <ol>
          <li>With an empty cart, tap <b>Cheesy Garlic Bread</b> (in Sides). <b>Press and hold its picture</b>: "someone is
            following or chasing you" appears under it. Set the quantity to <b>2</b> (two people) and tap <b>Add item</b>.</li>
          <li>Tap the <b>Add-ons</b> chip (the last one) and <b>ADD</b> <b>Extra Pepperoni</b> (a weapon).</li>
          <li><b>View cart</b> → <b>Proceed to checkout</b> → under <b>Delivery time</b> choose <b>As soon as possible</b> → <b>Place order</b>.</li>
          <li>The phone shows an ordinary <b>Order placed!</b> screen. On the dashboard a <b>Coded order</b> appears: HIGH,
            "Being followed or chased", "Weapon present", PEOPLE 2.</li>
          <li>Open it and click <b>Acknowledge</b>, then <b>Start response</b>, then <b>Resolve</b>. The phone's
            <b> Order status</b> follows: <b>Rider assigned</b> → <b>On the way</b> → <b>Delivered</b>.</li>
        </ol>
        <p className="muted">An order with no coded items (say, a Margherita Pizza) is just an order: nothing reaches the dashboard. All coded items: <a {...link('/manual/codes')}>code table</a>.</p>
        <ShotRow>
          <ManualShot name="qb-item-meaning" />
          <ManualShot name="qb-checkout" caption="Delivery time doubles as urgency." />
        </ShotRow>
        <ShotRow wide>
          <ManualShot name="dash-coded-order" caption="The coded cart on the dashboard: the meanings and the number of people, decoded at once." />
        </ShotRow>
      </Section>

      <Section id="recipe-instructions" title="5. Delivery instructions: a silent report" time="1 min">
        <ol>
          <li>With an empty cart, tap <b>Delivery instructions</b> (under "Ordering as guest"). A <b>Silent tap</b> case is
            already on the dashboard: the report starts the moment this screen opens.</li>
          <li><b>Press and hold</b> "Don't ring, leave silently": "A weapon is present — send help urgently" shows while you
            hold. Letting go selects it (tap again to unselect).</li>
          <li>Tap <b>Call on arrival</b> (someone with you may be a threat). Each tap reaches the dashboard straight away.</li>
          <li>Delivery address: <b>Convent Square, Alappuzha</b>. Note for rider: <b>Man with a knife at the gate</b>.
            Optionally <b>Choose a photo</b>: the AI reads it for vehicles, people and signs.</li>
          <li>Tap <b>Save instructions</b>. You're back on the menu with no confirmation; the dashboard places the address on the map.</li>
        </ol>
        <ShotRow>
          <ManualShot name="qb-instructions-hold" caption="Holding an option shows what it really means." />
        </ShotRow>
      </Section>

      <Section id="recipe-sos" title="6. Heart SOS: the phone looks switched off" time="1 min">
        <ol>
          <li>On the home screen, <b>double-tap the heart</b> (top right). The screen turns black and ignores touches.
            The first time, the browser may ask for the camera and microphone: allow them.</li>
          <li>Say, as if someone is holding you: <b>"Please let me go. Put the knife down. I won't tell anyone."</b></li>
          <li>On the dashboard: a <b>Silent SOS</b> with the <b>SOS · HOSTAGE</b> badge, HIGH straight away. Open it: live
            camera video (Back/Front), <b>Listen</b> for live audio, what the microphone hears in Conversation, and what the
            silent AI noticed in Threat and Seen &amp; heard.</li>
          <li>To stop, <b>tap the black screen three times quickly</b>. You're back on the menu; the case file fills in
            (summary, bulletin, camera recordings).</li>
        </ol>
      </Section>

      <Section id="after" title="7. After the calls">
        <ul>
          <li>Open your call and its <b>Case file</b>: AI case summary, privacy check, <b>Dispatch bulletin</b> (with "Copy for
            radio/handoff"), <b>Evidence recordings</b> and <b>Replay this call</b> (drag to any moment).</li>
          <li>The <b>Scene</b> tab draws the situation from the facts, each with its source.</li>
          <li><b>Case history</b> lists resolved cases; <b>Analytics</b> shows patterns, and its <b>AI Insights</b> tab writes
            suggested actions (click "Generate insights" or "Refresh").</li>
          <li>Please <b>Resolve</b> your test cases when you're done. Don't mark them <b>False alarm</b> or <b>Prank</b>
            (Caller check): later calls from your phone would no longer ring the alarm.</li>
        </ul>
        <p>More on every panel: <a {...link('/manual/dashboard')}>Responder dashboard →</a></p>
      </Section>

      <Section id="good-to-know" title="Good to know">
        <ul>
          <li><b>Find your case:</b> new cases sit at the top of the Live queue with an orange <b>New</b> mark until someone
            opens them. Opening a case clears that mark for everyone.</li>
          <li><b>Hang up with the red button.</b> Leaving the call with the browser's Back button keeps it running in the background.</li>
          <li>Calls wrap up after about 3 minutes, unless you're being chased.</li>
          <li>Live video goes straight from the phone to the laptop; on some mobile networks it can't connect. The call itself still works.</li>
          <li>"AI recommends" turns the facts the AI extracted into a dispatch suggestion using fixed rules.</li>
          <li>Resolved cases can't be reopened.</li>
        </ul>
      </Section>

      <Section id="trouble" title="If something goes wrong">
        <ul>
          <li><b>"Allow the microphone"</b> screen: follow its steps (and the permissions box above), then come back; the call connects by itself.</li>
          <li><b>"Couldn't connect"</b>: check the connection and tap Call to order again.</li>
          <li>Still stuck? Open the recorded calls in "Only 5 minutes?" above, or watch the <a href="/#demo">demo videos</a>.</li>
        </ul>
        <ShotRow>
          <ManualShot name="qb-mic-help" caption="If the microphone is blocked, the call screen explains how to allow it." />
        </ShotRow>
      </Section>
    </>
  )
}

const CHANNELS: [string, string, string, string, string][] = [
  ['Shows up', 'When the call starts', 'At "Place order"', 'When the screen opens', 'When the screen goes black'],
  ['Severity', 'Rises with each answer', 'HIGH for most items', 'Rises with each tap', 'HIGH at once'],
  ['Threat, Subjects', 'From Mia\'s questions', 'Decoded from the cart', 'From the taps (+ photo)', 'From what the AI hears/sees'],
  ['Location', 'Rough, then the spelled address', 'Rough position', 'Rough, then the typed address', 'Rough position'],
  ['Voice stress, Conversation', 'Yes', '—', '—', 'Yes (what the mic hears)'],
  ['Live video, Listen', 'Back camera', '—', '—', 'Back + front camera'],
  ['Message caller', 'Yes (Mia relays it)', '—', '—', '—'],
  ['After it ends', 'AI summary, bulletin, recordings', 'Stays Live until resolved', 'Fact sheet of what was reported', 'AI summary, bulletin, recordings'],
]

export function DashboardGuide({ link }: { link: LinkProps }) {
  return (
    <>
      <header className="manual-card-head manual-page-head">
        <span className="manual-icon">🖥️</span>
        <div>
          <h1 className="manual-title">Responder dashboard</h1>
          <span className="manual-tag">What the response team sees, live</span>
        </div>
      </header>
      <p className="manual-lead">
        Everything a caller does in QuickBite lands here as it happens: a new case the moment a call, order or report
        starts, then each fact as the AI understands it. Sign-in details are in the{' '}
        <a {...link('/manual/tour#setup')}>guided tour</a>.
      </p>

      <Section id="queue" title="Live queue">
        <p>
          Open cases, the newest pinned on top with an orange <b>New</b> mark until someone opens it (with a siren and a pop-up
          if sound is on). Each row shows severity, the way in (<b>Voice call</b>, <b>Coded order</b>, <b>Silent tap</b>,{' '}
          <b>Silent SOS</b>), whether it is still live, the first danger tags, people, voice stress and location.
        </p>
        <ShotRow wide><ManualShot name="dash-queue" /></ShotRow>
      </Section>

      <Section id="incident" title="The incident page">
        <p>Click a row to open it. The tiles around the map appear as soon as there is something to show, and update live.</p>
        <ShotRow wide><ManualShot name="dash-board" caption={`A recorded covert call (${RECORDED.covert}), after it ended.`} /></ShotRow>
        <ul>
          <li><b>Threat</b>: what is happening, in the AI's words; a weapon always stays on top.</li>
          <li><b>Subjects</b> and <b>Vehicle</b>: how many people, what they look like, the vehicle and its plate (from the answers or the camera).</li>
          <li><b>Location</b>: the rough position first, then the address the caller confirmed; "Moving" when the caller is on the move.</li>
          <li><b>Voice stress</b>: a 0–100 score from the caller's voice, with its trend.</li>
          <li><b>Seen &amp; heard</b>: what the back camera and the microphone picked up (a vehicle, a second voice, a bang).</li>
          <li><b>Nearby help</b> lists the nearest police, hospital and fire station; it becomes <b>Route to safety</b> with the
            destination, distance, time and next turn while Mia guides a caller who is moving.</li>
          <li><b>Linked cases</b>: other cases at the same place in the last 7 days, or the same person or vehicle (AI).</li>
        </ul>
      </Section>

      <Section id="panel" title="The side panel">
        <ShotRow>
          <ManualShot name="dash-conversation" caption="Conversation: the live transcript. Food words are struck through with their real meaning." />
          <ManualShot name="dash-scene" caption="Scene: a sketch of the situation and the facts behind it, with their source." />
          <ManualShot name="dash-casefile" caption="Case file: dispatch bulletin, recordings and a replay slider." />
        </ShotRow>
        <ul>
          <li><b>Message caller</b> (live calls only): quick messages or your own text; Mia slips it into the call as delivery chat, and the tab shows ✓ Delivered with her exact words.</li>
          <li><b>Case file</b>: the case report email status, the AI case summary with its privacy check, the caller check, the dispatch bulletin, the evidence recordings and the replay.</li>
          <li>While a call is live, the panel also shows the <b>live camera video</b> (full screen available) and <b>Listen</b> for live audio.</li>
        </ul>
      </Section>

      <Section id="channels" title="What each way in shows">
        <div className="manual-table-wrap">
          <table className="manual-table">
            <thead><tr><th /><th>Call to order</th><th>Click &amp; order</th><th>Delivery instructions</th><th>Heart SOS</th></tr></thead>
            <tbody>{CHANNELS.map(([k, ...v]) => <tr key={k}><th>{k}</th>{v.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section id="severity" title="How severity is set">
        <div className="manual-table-wrap">
          <table className="manual-table">
            <tbody>
              <tr><th><span className="sev sev-high">HIGH</span></th><td>Urgency is high, or a weapon, gunshot, knife, blood, fire, coercion or a snatched phone is reported, or voice stress is 80+.</td></tr>
              <tr><th><span className="sev sev-medium">MEDIUM</span></th><td>Urgency is medium, any other danger tag, or voice stress 55+.</td></tr>
              <tr><th><span className="sev sev-low">LOW</span></th><td>Nothing dangerous reported yet. Severity never goes down during a case.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="analytics" title="Case history and Analytics">
        <p>
          <b>Case history</b> lists resolved cases with search and filters. <b>Analytics</b> shows where and when incidents
          happen (map, trend, severity mix, time of day, hotspots); its <b>AI Insights</b> tab writes immediate actions,
          recommendations and suggestions from those patterns.
        </p>
        <ShotRow wide><ManualShot name="dash-analytics" /></ShotRow>
      </Section>
    </>
  )
}

const DELIVERY_OPTIONS: [string, string][] = [
  ['Ring the bell', "Everything's fine right now"],
  ['Leave at the door', 'I need help but no immediate danger — low urgency'],
  ['Call on arrival', 'Someone else is with me and may be a threat'],
  ['Handle with care — fragile', 'Someone is injured'],
  ["Don't ring, leave silently", 'A weapon is present — send help urgently'],
]

// The call's follow-up questions, as Mia asks them (web/src/lib/gemini/persona.ts, "Essential follow-ups").
const FOLLOW_UPS: [string, string][] = [
  ['How many pizzas — one, two, or a few?', 'How many people are involved'],
  ['Hand it to you, or leave it at the door?', 'Hand it: the person is still with you · door: they have gone'],
  ['Collect it outside, or should the rider bring it in?', 'Collect: you can get out now · bring it in: you can’t leave'],
  ['Small, medium, or large size?', 'A knife · a stick or blunt object · a gun'],
  ['A few napkins or a whole pack?', 'A small injury · badly hurt or bleeding'],
  ['Pick it up, or by bike or car?', 'The attacker is on foot · on a bike · in a car'],
  ['Barbecue, mayo, or ketchup sauce?', 'Vehicle colour: dark · white/silver · red/bright'],
  ['Cola, lemon, or orange?', 'Clothes: dark · white/light · bright'],
  ['Whenever, within the hour, or as soon as possible?', 'How urgent it is'],
]

export function CodeTable() {
  const coded = ALL_CODES.map((c) => ({ code: c, item: MENU.find((m) => m.code === c.id) })).filter((x) => x.item)
  const sectionOf = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id
  const addons = coded.filter((x) => x.item!.category === 'addons').length
  const lookalikes = MENU.filter((m) => m.category === 'addons' && !m.code).map((m) => m.name)
  return (
    <>
      <header className="manual-card-head manual-page-head">
        <span className="manual-icon">🍕</span>
        <div>
          <h1 className="manual-title">Code table</h1>
          <span className="manual-tag">For Click &amp; order (and what Mia's words mean)</span>
        </div>
      </header>
      <p className="manual-lead">
        On a call you never need this: Mia says each meaning in the same sentence. For a coded order, add the item that
        matches the situation. In the app you can always check: tap an item and press and hold its picture.
      </p>

      <Section id="coded-items" title={`${coded.length} coded items: ${coded.length - addons} dishes and ${addons} add-ons`}>
        <div className="manual-table-wrap">
          <table className="manual-table manual-codes-table">
            <thead><tr><th>Menu item</th><th>Where</th><th>Real meaning</th><th>Mia says on a call</th></tr></thead>
            <tbody>
              {coded.map(({ code, item }) => (
                <tr key={code.id}>
                  <td className="manual-food">
                    <img src={item!.image} alt="" width={56} height={42} loading="lazy" />
                    <b>{item!.name}</b>
                  </td>
                  <td>{sectionOf(item!.category)}</td>
                  <td>{code.meaning.charAt(0).toUpperCase() + code.meaning.slice(1)}{code.scope === 'other' && <em className="manual-scope">about someone else</em>}</td>
                  <td>"{code.food}"</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          <li><b>Quantity</b> = how many people are involved (the largest quantity of a coded item counts).</li>
          <li><b>Delivery time</b> at checkout can only raise urgency: Standard = low, Priority = medium, As soon as possible = high. Most coded items are already high.</li>
          <li>{lookalikes.join(' and ')} are ordinary add-ons with no meaning, despite looking like {lookalikes.length > 1 ? 'coded ones' : 'a coded one'}.</li>
          <li>An order with no coded items is just an order: nothing is sent.</li>
        </ul>
        <div className="manual-tips">
          <p>🧩 <b>More coded foods can be added later.</b> Each code is one entry in the shared code list plus the dish on
            the menu; Mia's spoken options, the checkout, the dashboard and the hold-to-reveal hint all pick it up automatically.</p>
        </div>
        <ShotRow>
          <ManualShot name="qb-addons" caption="The coded extras sit among ordinary add-ons." />
          <ManualShot name="qb-item-meaning" />
        </ShotRow>
      </Section>

      <Section id="call-codes" title="On a call: Mia's follow-up questions">
        <p>Mia asks only the ones that matter, always with their meaning in the same sentence.</p>
        <div className="manual-table-wrap">
          <table className="manual-table">
            <thead><tr><th>Mia asks</th><th>It means</th></tr></thead>
            <tbody>{FOLLOW_UPS.map(([q, m]) => <tr key={q}><td>"{q}"</td><td>{m}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section id="instruction-codes" title="Delivery instructions">
        <div className="manual-table-wrap">
          <table className="manual-table">
            <thead><tr><th>Option</th><th>Real meaning (shown while you hold it)</th></tr></thead>
            <tbody>{DELIVERY_OPTIONS.map(([o, m]) => <tr key={o}><td><b>{o}</b></td><td>{m}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
