import type { ReactNode } from 'react'
import { Phone } from './ui'

/* Per-feature mock screens, shown in the bento lightbox until a real screenshot is dropped into /shots. */

const Btn = ({ children }: { children: ReactNode }) => (
  <div style={{ marginTop: 14, background: '#e23744', color: '#fff', textAlign: 'center', padding: 11, borderRadius: 12, fontWeight: 700 }}>{children}</div>
)

function PhoneStage({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mock-stage">
      <div style={{ transform: 'scale(.82)', transformOrigin: 'center' }}><Phone>{children}</Phone></div>
      {note && <div className="mock-side">{note}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mock-box"><small>{title}</small><div style={{ marginTop: 8 }}>{children}</div></div>
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return <div className="dash-row"><span>{k}</span>{c ? <span className={`chip ${c}`}>{v}</span> : <b style={{ fontSize: 13 }}>{v}</b>}</div>
}

const MOCKS: Record<string, ReactNode> = {
  silent: (
    <PhoneStage note={<><b>Nothing to say out loud</b><p>Each chip is a coded signal. Hold one to see its detail, styled like a normal app hint.</p></>}>
      <div className="qb">
        <b style={{ fontSize: 16 }}>Any special instructions?</b>
        <p style={{ color: '#888', margin: '4px 0 10px' }}>Tap to select. Press and hold for detail.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Don\'t ring the bell', 'Leave at door', 'Call on arrival', 'Extra cutlery', 'Contactless', 'Come quickly'].map((c, i) => (
            <span key={c} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #e23744', background: i % 3 === 0 ? '#e23744' : '#fff', color: i % 3 === 0 ? '#fff' : '#e23744', fontWeight: 600 }}>{c}</span>
          ))}
        </div>
        <div className="qb-search" style={{ marginTop: 12, color: '#333' }}>📍 Delivery address</div>
        <div className="qb-search" style={{ color: '#333' }}>📷 Add a photo (optional)</div>
        <div className="qb-search" style={{ height: 54 }}>Note for rider…</div>
        <Btn>Save instructions</Btn>
      </div>
    </PhoneStage>
  ),
  exit: (
    <div className="mock-stage">
      {['Report sent', 'Backed out'].map((t) => (
        <div key={t} style={{ textAlign: 'center' }}>
          <div style={{ transform: 'scale(.7)', transformOrigin: 'top center', height: 400 }}>
            <Phone><div className="qb"><div className="qb-top"><span className="qb-brand">QuickBite</span><span>🛒</span></div><div className="qb-search">🔍 Search pizza, biryani…</div><div className="qb-banner"><b>50% OFF</b>on your first order</div></div></Phone>
          </div>
          <b>{t}</b>
        </div>
      ))}
      <div className="mock-side"><b>Identical on purpose</b><p>Both end on the ordinary home screen, instantly, with no dialog. Back never returns to the call.</p></div>
    </div>
  ),
  appearance: (
    <PhoneStage note={<><b>Blend in</b><p>Pick an icon and a name so the app matches the others on the phone. It's saved across restarts.</p></>}>
      <div className="qb">
        <b style={{ fontSize: 16 }}>App appearance</b>
        <p style={{ color: '#888', margin: '4px 0 12px' }}>Icon</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {['🍔', '🧮', '🌦️', '📒', '🎵', '🧭'].map((e, i) => (
            <div key={e} style={{ height: 58, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 28, background: '#f4f5f7', outline: i === 1 ? '2px solid #e23744' : 'none' }}>{e}</div>
          ))}
        </div>
        <p style={{ color: '#888', margin: '14px 0 6px' }}>App name</p>
        <div className="qb-search" style={{ color: '#333' }}>Calculator</div>
        <Btn>Save</Btn>
      </div>
    </PhoneStage>
  ),
  route: (
    <div className="mock">
      <div className="mock-row">
        <Panel title="Movement"><Row k="Caller" v="Moving" c="high" /><Row k="Followed" v="Yes" c="high" /></Panel>
        <Panel title="Relayed to caller"><p style={{ margin: 0, lineHeight: 1.5 }}>"Our rider says take the next left towards the market. It's busier there."</p></Panel>
      </div>
      <div className="mock-box mock-map" style={{ flex: 1 }}>
        <svg viewBox="0 0 400 150" style={{ width: '100%', height: '100%' }}>
          <path d="M20 120 C 120 110, 150 40, 250 50 S 360 30, 380 20" fill="none" stroke="var(--live)" strokeWidth="4" strokeDasharray="8 6" />
          <circle cx="20" cy="120" r="8" fill="var(--low)" /><circle cx="380" cy="20" r="8" fill="var(--high)" />
          <text x="34" y="124" fontSize="12" fill="#333">caller</text><text x="300" y="24" fontSize="12" fill="#333">police station</text>
        </svg>
      </div>
    </div>
  ),
  video: (
    <div className="mock">
      <div className="mock-box" style={{ flex: 1, background: '#0e121c', color: '#fff', display: 'grid', placeItems: 'center', position: 'relative' }}>
        <span className="chip live" style={{ position: 'absolute', top: 12, left: 12 }}>● LIVE · Back camera</span>
        <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, color: '#9aa4b6' }}>Back | Front</span>
        <span style={{ fontSize: 44 }}>🎥</span>
      </div>
      <div className="mock-row">
        <Panel title="Recording"><Row k="Back camera" v="Uploaded to Drive" c="live" /></Panel>
        <Panel title="Caller's screen"><b>Still shows the order</b></Panel>
      </div>
    </div>
  ),
  seen: (
    <div className="mock">
      <Panel title="Seen & heard">
        <Row k="🔊 Sound · raised male voice, Malayalam" v="high" c="high" />
        <Row k="🔊 Sound · glass breaking" v="high" c="high" />
        <Row k="📷 Camera · second person near door" v="med" c="med" />
        <Row k="📷 Camera · kitchen, lights on" v="low" c="live" />
      </Panel>
      <Panel title="Kept separate from what the caller said"><p style={{ margin: 0 }}>Dangerous observations become danger tags and raise severity.</p></Panel>
    </div>
  ),
  search: (
    <div className="mock">
      <div className="mock-box" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>calls near Vazhicherry last week with a weapon</span><span className="chip acc">Ask AI</span>
      </div>
      <Panel title="Gemini understood">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="chip acc">near Vazhicherry</span><span className="chip acc">last 7 days</span><span className="chip high">weapon</span>
        </div>
      </Panel>
      <Panel title="3 matching incidents">
        <Row k="INC-MUL8HBGM · Voice call" v="HIGH" c="high" />
        <Row k="INC-MUIDSKPZ · Voice call" v="HIGH" c="high" />
        <Row k="INC-MUL7VEEI · Coded order" v="MEDIUM" c="med" />
      </Panel>
    </div>
  ),
}

export function mockFor(shot: string): ReactNode | undefined {
  return MOCKS[shot]
}
