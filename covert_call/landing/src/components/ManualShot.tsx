import { useState, type ReactNode } from 'react'
import { Browser, Modal } from './ui'

// Real screenshots for the user manual, taken from the live app by scripts/capture-manual-shots.mjs
// (public/shots/manual/*.webp). Numbered badges are drawn into the image itself; `legend` repeats them as text.
type ShotInfo = { alt: string; w: number; h: number; phone?: boolean; legend?: string[] }

const PHONE = { w: 780, h: 1688, phone: true }
const DESK = { w: 2000, h: 1250 }
const PANEL = { w: 480, h: 903 }

const SHOTS = {
  'qb-home': {
    ...PHONE,
    alt: 'QuickBite home screen with the hidden controls numbered',
    legend: [
      'Heart: double-tap for the silent SOS',
      'Account (mobile number, trusted contacts)',
      'Category chips: coded extras are under Add-ons (swipe to the end)',
      'Delivery instructions: the silent report',
      'Call to order: the call with Mia',
    ],
  },
  'qb-addons': { ...PHONE, alt: 'The Add-ons list in QuickBite, with Extra Pepperoni among ordinary add-ons' },
  'qb-item-meaning': {
    ...PHONE,
    alt: 'Cheesy Garlic Bread item sheet with its hidden meaning shown under the picture',
    legend: ['Press and hold the picture', 'The real meaning appears here', 'Quantity = number of people', 'Add item'],
  },
  'qb-checkout': { ...PHONE, alt: 'Checkout with the Delivery time card set to As soon as possible' },
  'qb-order-placed': { ...PHONE, alt: 'Order placed screen with the order status steps' },
  'qb-order-on-the-way': { ...PHONE, alt: 'Order placed screen showing On the way after a responder started the response' },
  'qb-call': { ...PHONE, alt: 'The QuickBite Order Desk call screen during a call' },
  'qb-mic-help': { ...PHONE, alt: 'The Allow the microphone help screen with steps for Android' },
  'qb-instructions-hold': { ...PHONE, alt: 'Delivery instructions screen with an option held to show its meaning' },
  'dash-queue': {
    ...DESK,
    alt: 'Responder dashboard Live queue with a new coded order at the top',
    legend: ['Counters', 'A new incident, pinned on top with an orange "New" mark', 'Plain-language search (Ask AI)', 'Sort order'],
  },
  'dash-board': {
    ...DESK,
    alt: 'Responder dashboard incident page for a recorded covert call, with its parts numbered',
    legend: [
      'Header: case id, severity, status, channel and start time',
      'AI recommends: the suggested response, updated as facts arrive',
      'Response buttons: Acknowledge → Start response → Resolve',
      'Map hub: severity, live timer, then "Case record"',
      'Threat: what is happening, decoded from the answers',
      'Location: rough position first, then the confirmed address',
      'Voice stress: 0–100, with its trend',
      'Seen & heard: what the camera and microphone picked up',
      'Nearby help: police, hospital and fire station (becomes Route to safety when the caller is moving)',
      'Linked cases: same place or same person/vehicle',
      'Side panel: Conversation, Scene, Message caller, Case file',
      'Timeline of everything that happened',
    ],
  },
  'dash-conversation': { ...PANEL, alt: 'Conversation tab: the caller said a food word, shown struck through with its real meaning' },
  'dash-casefile': { ...PANEL, alt: 'Case file tab: dispatch bulletin, evidence recordings and the replay slider' },
  'dash-scene': { ...PANEL, alt: 'Scene tab: a sketch of the scene and the facts behind it' },
  'dash-route': { ...DESK, alt: 'Recorded chase call: Route to safety tile and the route on the map' },
  'dash-coded-order': { ...DESK, alt: 'Incident page for a coded order: Threat and Subjects filled in from the cart' },
  'dash-silent-tap': { ...DESK, alt: 'Incident page for a silent report from Delivery instructions' },
  'dash-analytics': { ...DESK, alt: 'Analytics page with counters, incident map and charts' },
} satisfies Record<string, ShotInfo>

export type ShotName = keyof typeof SHOTS

const src = (name: ShotName) => `/shots/manual/${name}.webp?v=${__BUILD_ID__}`

/** A real screenshot: phone shots in a plain phone frame, dashboard shots in a browser frame. Click to enlarge. */
export function ManualShot({ name, caption }: { name: ShotName; caption?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const s: ShotInfo = SHOTS[name]
  const img = <img src={src(name)} alt={s.alt} width={s.w} height={s.h} loading="lazy" decoding="async" />
  return (
    <figure className={`manual-shot ${s.phone ? 'is-phone' : 'is-desk'}`}>
      <button type="button" className="manual-shot-zoom" onClick={() => setOpen(true)} aria-label={`Enlarge: ${s.alt}`}>
        {s.phone ? img : <Browser url="quickbite-5cde0-dashboard.web.app">{img}</Browser>}
      </button>
      {(caption || s.legend) && (
        <figcaption>
          {caption && <span className="manual-shot-caption">{caption}</span>}
          {s.legend && <ol className="manual-legend">{s.legend.map((l) => <li key={l}>{l}</li>)}</ol>}
        </figcaption>
      )}
      <Modal open={open} onClose={() => setOpen(false)} wide>
        <figure className="gallery-full">
          <img src={src(name)} alt={s.alt} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      </Modal>
    </figure>
  )
}

/** Lays screenshots out side by side; `wide` gives each one the full width (dashboard shots). */
export function ShotRow({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`manual-shots${wide ? ' wide' : ''}`}>{children}</div>
}
