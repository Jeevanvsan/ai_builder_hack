// Demo recording control panel (staging only: /demo-control). Pick a live call, then a clip: from then on that
// call's camera shows the clip (Mia and the dashboard see it as the camera), until another clip or "Real camera".
// Sounds play into the call once (or loop). The caller's phone needs nothing special: every call listens.
//
// Signs in as a responder in its OWN Firebase app instance, so a caller session in the same browser is untouched.
import { useEffect, useMemo, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { collection, doc, getFirestore, onSnapshot, query, setDoc, where } from 'firebase/firestore'
import { DEMO_CONTROL, type DemoControl } from '../lib/demoInject'
import { DEFAULT_SCENARIO, SCENARIOS } from '../lib/aiCaller'

declare const __DEMO_V__: string
const APP_NAME = 'demo-control'
const app = getApps().find((a) => a.name === APP_NAME) ?? initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}, APP_NAME)
const auth = getAuth(app)
const db = getFirestore(app)

type LiveCall = { id: string; collection: string; startedAt: string; channel: string; severity: string; tags: string[] }
type Manifest = { videos: string[]; sounds: string[] }

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }
const btn = (on = false): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? '#e4572e' : '#d1d5db'}`, cursor: 'pointer',
  background: on ? '#e4572e' : '#fff', color: on ? '#fff' : '#1f2937', fontWeight: 600, margin: '0 8px 8px 0',
})

export default function DemoControlPage() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [calls, setCalls] = useState<LiveCall[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [control, setControl] = useState<DemoControl>({})
  const [manifest, setManifest] = useState<Manifest>({ videos: [], sounds: [] })
  const [videoPick, setVideoPick] = useState<string | null>(null)
  const [videoLoop, setVideoLoop] = useState(true)
  const [soundPick, setSoundPick] = useState<string | null>(null)
  const [soundLoop, setSoundLoop] = useState(false)
  const [sent, setSent] = useState('')
  // Preview plays here on the laptop only; nothing reaches the call.
  const [preview, setPreview] = useState<{ kind: 'video' | 'sound'; name: string } | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => { void fetch(`/demo/manifest.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).then(setManifest).catch(() => {}) }, [])

  // Live calls from both collections, newest first.
  useEffect(() => {
    if (!user) return
    const parts = new Map<string, LiveCall[]>()
    const unsubs = ['incidents', 'demoIncidents'].map((col) =>
      onSnapshot(query(collection(db, col), where('callState', '==', 'active')), (snap) => {
        parts.set(col, snap.docs.map((d) => {
          const x = d.data()
          return { id: d.id, collection: col, startedAt: String(x.sessionStartedAt ?? ''), channel: String(x.channel ?? ''), severity: String(x.severity ?? ''), tags: (x.extractedFieldsLive?.dangerIndicators ?? []) as string[] }
        }))
        setCalls([...parts.values()].flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
      }, () => {}),
    )
    return () => unsubs.forEach((u) => u())
  }, [user])

  // What the selected call is currently showing.
  useEffect(() => {
    if (!selected) return
    return onSnapshot(doc(db, DEMO_CONTROL, selected), (s) => setControl((s.data() ?? {}) as DemoControl), () => {})
  }, [selected])

  const send = async (patch: DemoControl, label: string) => {
    if (!selected) return
    setError('')
    try {
      await setDoc(doc(db, DEMO_CONTROL, selected), patch, { merge: true })
      setSent(`${label} → ${selected}`)
    } catch (e) {
      setError(`Couldn't send: ${(e as Error).message}`)
    }
  }

  const selectedCall = useMemo(() => calls.find((c) => c.id === selected), [calls, selected])

  // Chase demo: the call's route to safety and the caller's latest position, to watch the simulated GPS move.
  const [routeInfo, setRouteInfo] = useState<{ dest: string; kind: string; leftM: number | null; lat: number | null; lng: number | null; speed: number | null } | null>(null)
  const [setPos, setSetPos] = useState('')
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO)
  const [voice, setVoice] = useState('Aoede')
  const [muteMic, setMuteMic] = useState(true)
  useEffect(() => {
    if (!selected || !selectedCall) { setRouteInfo(null); return }
    return onSnapshot(doc(db, selectedCall.collection, selected), (s) => {
      const x = s.data() ?? {}
      const r = x.safeRoute
      const track = (x.location?.track ?? []) as { lat: number; lng: number; speed?: number | null }[]
      const last = track[track.length - 1] ?? x.location?.rough ?? null
      let leftM: number | null = null
      if (r && last) {
        const steps = (r.steps ?? []) as { distanceM: number }[]
        leftM = steps.slice(r.stepIndex ?? 0).reduce((a, st) => a + (st.distanceM ?? 0), 0)
      }
      setRouteInfo({ dest: r?.destination?.name ?? '', kind: r?.destination?.kind ?? '', leftM, lat: last?.lat ?? null, lng: last?.lng ?? null, speed: last?.speed ?? null })
    }, () => {})
  }, [selected, selectedCall])

  if (!user) {
    return (
      <main style={{ maxWidth: 420, margin: '48px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Demo feed control</h1>
        <p style={{ color: '#6b7280' }}>Sign in with a responder account.</p>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); void signInWithEmailAndPassword(auth, email, password).catch((err) => setError(err.message)) }}>
          <input style={{ ...box, width: '100%', padding: 10, marginBottom: 8 }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input style={{ ...box, width: '100%', padding: 10, marginBottom: 8 }} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button style={btn(true)} type="submit">Sign in</button>
        </form>
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Demo feed control</h1>
        <button style={btn()} onClick={() => void signOut(auth)}>Sign out ({user.email})</button>
      </div>
      <p style={{ color: '#6b7280', marginTop: 0 }}>For recording the demo video. Pick a live call, then a clip: from then on that call streams it as its camera. Preview plays a clip here only (no call needed).</p>

      <section style={box}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>1. Live call</h2>
        {!calls.length && <p style={{ color: '#6b7280' }}>No live calls. Start a call in the app; it appears here.</p>}
        {calls.map((c) => (
          <button key={c.id} style={{ ...btn(c.id === selected), display: 'block', width: '100%', textAlign: 'left', borderRadius: 10 }} onClick={() => setSelected(c.id)}>
            {c.id} · {c.channel} · {c.severity}{c.collection === 'demoIncidents' ? ' · DEMO' : ''} · started {new Date(c.startedAt).toLocaleTimeString()}
            {c.tags.length > 0 && <span style={{ fontWeight: 400 }}> · {c.tags.slice(0, 3).join(', ')}</span>}
          </button>
        ))}
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>2. Camera {selectedCall && <span style={{ fontWeight: 400, color: '#6b7280' }}>· now streaming: <b>{control.video ? `${control.video}${control.loopVideo === false ? ' (once)' : ' (loop)'}` : 'real camera'}</b></span>}</h2>
        <div>{manifest.videos.map((v) => <button key={v} style={btn(videoPick === v)} onClick={() => setVideoPick(v)}>{v}</button>)}</div>
        <label style={{ display: 'block', margin: '4px 0 10px' }}><input type="checkbox" checked={videoLoop} onChange={(e) => setVideoLoop(e.target.checked)} /> Loop (off = play once, then back to the real camera)</label>
        <button style={{ ...btn(), opacity: videoPick ? 1 : 0.5 }} disabled={!videoPick} onClick={() => videoPick && setPreview(preview?.kind === 'video' && preview.name === videoPick ? null : { kind: 'video', name: videoPick })}>{preview?.kind === 'video' && preview.name === videoPick ? '✕ Close preview' : '👁 Preview'}</button>
        <button style={{ ...btn(true), opacity: videoPick && selected ? 1 : 0.5 }} disabled={!videoPick || !selected} onClick={() => videoPick && void send({ video: videoPick, videoAt: Date.now(), loopVideo: videoLoop }, `Start ${videoPick}${videoLoop ? ' (loop)' : ' (once)'}`)}>▶ Start video</button>
        <button style={{ ...btn(), opacity: selected ? 1 : 0.5 }} disabled={!selected} onClick={() => void send({ video: null, videoAt: Date.now() }, 'Real camera')}>■ Stop (real camera)</button>
        {preview?.kind === 'video' && <video key={preview.name} src={`/demo/video/${preview.name}.mp4?v=${__DEMO_V__}`} controls autoPlay loop muted playsInline style={{ display: 'block', width: '100%', maxWidth: 480, borderRadius: 10, background: '#000', marginTop: 8 }} />}
      </section>

      <section style={box}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>3. Background sound {selectedCall && control.sound && <span style={{ fontWeight: 400, color: '#6b7280' }}>· last: <b>{control.sound}{control.loopSound ? ' (loop)' : ''}</b></span>}</h2>
        <div>{manifest.sounds.map((x) => <button key={x} style={btn(soundPick === x)} onClick={() => setSoundPick(x)}>{x}</button>)}</div>
        <label style={{ display: 'block', margin: '4px 0 10px' }}><input type="checkbox" checked={soundLoop} onChange={(e) => setSoundLoop(e.target.checked)} /> Loop</label>
        <button style={{ ...btn(), opacity: soundPick ? 1 : 0.5 }} disabled={!soundPick} onClick={() => soundPick && setPreview(preview?.kind === 'sound' && preview.name === soundPick ? null : { kind: 'sound', name: soundPick })}>{preview?.kind === 'sound' && preview.name === soundPick ? '✕ Close preview' : '👁 Preview'}</button>
        <button style={{ ...btn(true), opacity: soundPick && selected ? 1 : 0.5 }} disabled={!soundPick || !selected} onClick={() => soundPick && void send({ sound: soundPick, soundAt: Date.now(), loopSound: soundLoop }, `Play ${soundPick}${soundLoop ? ' (loop)' : ''}`)}>▶ Play sound</button>
        <button style={{ ...btn(), opacity: selected ? 1 : 0.5 }} disabled={!selected} onClick={() => void send({ sound: null, soundAt: Date.now(), loopSound: false }, 'Sound off')}>■ Stop sound</button>
        {preview?.kind === 'sound' && <audio key={preview.name} src={`/demo/sound/${preview.name}.mp3?v=${__DEMO_V__}`} controls autoPlay style={{ display: 'block', width: '100%', maxWidth: 480, marginTop: 8 }} />}
      </section>


      <section style={{ ...box, opacity: selected ? 1 : 0.5, pointerEvents: selected ? 'auto' : 'none' }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>4. Chase &amp; route to safety</h2>
        <p style={{ color: '#6b7280', marginTop: 0, fontSize: 14 }}>
          On the caller's phone, open the app once with <code>?demoInject=1&amp;gpsSim=LAT,LNG</code> (the start point, e.g. <code>gpsSim=9.4981,76.3388</code>) so its GPS is simulated. The phone holds there until Mia has a route, then moves along exactly her route and stops at the destination. Without gpsSim the real GPS is used.
        </p>
        <button style={btn(true)} onClick={() => void send({ chaseAt: Date.now() }, 'Start chase & route')}>🏃 Start chase &amp; route</button>
        <div style={{ margin: '6px 0 10px' }}>
          <b style={{ fontSize: 14, marginRight: 8 }}>Speed</b>
          {[{ k: 6, l: 'Walk 6 km/h' }, { k: 12, l: 'Run 12' }, { k: 25, l: 'Scooter 25' }, { k: 40, l: 'Car 40' }, { k: 80, l: 'Fast-forward 80' }].map((o) => (
            <button key={o.k} style={btn(control.gpsSpeedKmh === o.k)} onClick={() => void send({ gpsSpeedKmh: o.k }, `Speed ${o.k} km/h`)}>{o.l}</button>
          ))}
        </div>
        <button style={btn(!!control.gpsPaused)} onClick={() => void send({ gpsPaused: !control.gpsPaused }, control.gpsPaused ? 'Resume moving' : 'Pause (stand still)')}>{control.gpsPaused ? '▶ Resume moving' : '⏸ Pause (stand still)'}</button>
        <button style={btn()} onClick={() => void send({ gpsJumpAt: Date.now(), gpsJumpM: 150 }, 'Jump 150 m ahead')}>⏩ Jump 150 m ahead</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input value={setPos} onChange={(e) => setSetPos(e.target.value)} placeholder="Move to lat,lng (e.g. 9.4981,76.3388)" style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
          <button style={btn()} onClick={() => {
            const [lat, lng] = setPos.split(',').map((v) => Number(v.trim()))
            if (Number.isFinite(lat) && Number.isFinite(lng)) void send({ gpsSetAt: Date.now(), gpsSet: { lat, lng } }, `Moved to ${lat},${lng}`)
            else setError('Enter the position as lat,lng')
          }}>📍 Move here</button>
        </div>
        {routeInfo && (
          <p style={{ fontSize: 14, marginBottom: 0 }}>
            {routeInfo.dest ? <>Route: <b>{routeInfo.kind} · {routeInfo.dest}</b>{routeInfo.leftM != null && <> · about {Math.round(routeInfo.leftM)} m to go</>}</> : <span style={{ color: '#6b7280' }}>No route yet (Mia plans it once the caller is on the move).</span>}
            {routeInfo.lat != null && <><br />Caller at {routeInfo.lat.toFixed(5)}, {routeInfo.lng?.toFixed(5)}{routeInfo.speed ? ` · ${Math.round(routeInfo.speed * 3.6)} km/h` : ''}</>}
          </p>
        )}
      </section>


      <section style={{ ...box, opacity: selected ? 1 : 0.5, pointerEvents: selected ? 'auto' : 'none' }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>5. AI caller voice {control.aiCallerOn && <span style={{ color: '#047857', fontWeight: 600 }}>· talking</span>}</h2>
        <p style={{ color: '#6b7280', marginTop: 0, fontSize: 14 }}>
          A second AI voice plays the caller: it hears Mia and answers her out loud into the call, so the whole scene runs by itself
          (with section 4's simulated GPS, Mia's directions move the caller too). Fully automatic: open the phone once with
          <code> ?demoInject=1&amp;aiCaller=1&amp;gpsSim=LAT,LNG</code> (chase) or <code>?demoInject=1&amp;aiCaller=domestic</code> and just tap "Call to order". Turn off with <code>?aiCaller=0</code>.
        </p>
        <div style={{ marginBottom: 8 }}>
          <b style={{ fontSize: 14, marginRight: 8 }}>Scenario</b>
          {Object.entries(SCENARIOS).map(([k, v]) => <button key={k} style={btn(scenario === v.text)} onClick={() => setScenario(v.text)}>{v.label}</button>)}
        </div>
        <textarea value={scenario} onChange={(e) => setScenario(e.target.value)} rows={7} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', font: 'inherit', fontSize: 14 }} />
        <div style={{ margin: '8px 0' }}>
          <b style={{ fontSize: 14, marginRight: 8 }}>Voice</b>
          {['Aoede', 'Kore', 'Leda', 'Zephyr'].map((v) => <button key={v} style={btn(voice === v)} onClick={() => setVoice(v)}>{v}</button>)}
          <label style={{ marginLeft: 8, fontSize: 14 }}><input type="checkbox" checked={muteMic} onChange={(e) => setMuteMic(e.target.checked)} /> Mute the phone's real mic</label>
        </div>
        <button style={btn(true)} onClick={() => void send({ aiCallerAt: Date.now(), aiCallerOn: true, aiScenario: scenario, aiVoice: voice, aiMuteMic: muteMic }, `AI caller on (${voice})`)}>🎙 Start AI caller</button>
        <button style={btn()} onClick={() => void send({ aiCallerAt: Date.now(), aiCallerOn: false }, 'AI caller off')}>■ Stop AI caller</button>
      </section>

      {sent && <p style={{ color: '#047857' }}>✓ {sent}</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
    </main>
  )
}
