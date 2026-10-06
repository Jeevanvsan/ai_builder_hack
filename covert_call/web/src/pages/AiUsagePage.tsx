// AI usage per call (staging only: /ai-usage). For every incident: tokens and estimated cost per task (live call,
// SOS observer, case summary, case linking, photo vision, credibility), split by modality, so the biggest consumer
// is obvious. Data: incidents/{id}.aiUsage (written by the apps as Gemini responses arrive); prices and the
// task→model map: shared/aiModels.ts. Estimates at paid-tier prices; free-tier requests actually cost nothing.
import { useEffect, useMemo, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { estimateCostUsd, USD_TO_INR, type AiTaskUsage } from '../../../shared/aiModels.ts'

const APP_NAME = 'ai-usage'
const app = getApps().find((a) => a.name === APP_NAME) ?? initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}, APP_NAME)
const db = getFirestore(app)

type Row = { id: string; demo: boolean; startedAt: string; channel: string; severity: string; usage: Record<string, AiTaskUsage> }
const TASK_LABEL: Record<string, string> = {
  liveCall: 'Live call (Mia)', sosObserver: 'Silent SOS observer', consolidation: 'Case summary', caseLinking: 'Case linking',
  photoVision: 'Photo vision', credibility: 'Credibility check', groundedContext: 'Weather/road context',
}
const tokens = (u: Partial<AiTaskUsage>) => (u.inText ?? 0) + (u.inAudio ?? 0) + (u.inImage ?? 0) + (u.outText ?? 0) + (u.outAudio ?? 0)
const inr = (usd: number) => `₹${(usd * USD_TO_INR).toFixed(usd * USD_TO_INR < 1 ? 3 : 2)}`
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

const page: React.CSSProperties = { maxWidth: 1100, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#1f2937' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }
const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6', fontSize: 13, whiteSpace: 'nowrap' }

function Bar({ value, max }: { value: number; max: number }) {
  return <div style={{ background: '#f3f4f6', borderRadius: 4, height: 8, width: 120 }}><div style={{ background: '#e4572e', height: 8, borderRadius: 4, width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
}

export default function AiUsagePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState<string | null>(null)
  // Real calls only by default; test-harness and hidden demo calls (demoIncidents) only when asked for.
  const [includeDemo, setIncludeDemo] = useState(false)

  useEffect(() => {
    const parts = new Map<string, Row[]>()
    const cols = includeDemo ? ['incidents', 'demoIncidents'] : ['incidents']
    setRows([])
    const unsubs = cols.map((col) =>
      onSnapshot(query(collection(db, col), orderBy('sessionStartedAt', 'desc'), limit(60)), (snap) => {
        parts.set(col, snap.docs.filter((d) => d.data().aiUsage).map((d) => {
          const x = d.data()
          return { id: d.id, demo: col === 'demoIncidents', startedAt: String(x.sessionStartedAt ?? ''), channel: String(x.channel ?? ''), severity: String(x.severity ?? ''), usage: x.aiUsage as Record<string, AiTaskUsage> }
        }))
        setRows([...parts.values()].flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
      }, () => {}),
    )
    return () => unsubs.forEach((u) => u())
  }, [includeDemo])

  // Totals across all listed calls: per task and per modality, to show where consumption is.
  const totals = useMemo(() => {
    const byTask = new Map<string, { usd: number; tokens: number; requests: number; calls: number; model: string }>()
    const byModality = { 'Text in': 0, 'Audio in': 0, 'Camera in': 0, 'Text out': 0, 'Voice out': 0 }
    let usd = 0
    let billed = 0
    for (const r of rows) {
      for (const [task, u] of Object.entries(r.usage)) {
        const c = estimateCostUsd(u)
        usd += c
        if (u.tier === 'paid') billed += c
        const t = byTask.get(task) ?? { usd: 0, tokens: 0, requests: 0, calls: 0, model: u.model }
        t.usd += c; t.tokens += tokens(u); t.requests += u.requests ?? 0; t.calls++
        byTask.set(task, t)
        byModality['Text in'] += u.inText ?? 0; byModality['Audio in'] += u.inAudio ?? 0; byModality['Camera in'] += u.inImage ?? 0
        byModality['Text out'] += u.outText ?? 0; byModality['Voice out'] += u.outAudio ?? 0
      }
    }
    return { usd, billed, byTask: [...byTask.entries()].sort((a, b) => b[1].usd - a[1].usd), byModality }
  }, [rows])

  const maxTask = totals.byTask[0]?.[1].usd ?? 0
  const maxMod = Math.max(...Object.values(totals.byModality))

  return (
    <main style={page}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>AI usage per call</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Token counts are the real numbers Gemini reported for each request. Costs use Google's paid-tier prices (₹{USD_TO_INR}/$):
        "actually billed" counts only requests made on the paid key; requests on the free tier cost nothing.
        Task→model map and prices: <code>shared/aiModels.ts</code>.
      </p>

      <label style={{ display: 'block', marginBottom: 12 }}>
        <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /> Include test/demo calls (AI test harness, hidden demo)
      </label>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={{ color: '#6b7280', fontSize: 12 }}>{rows.length} {includeDemo ? 'calls (real + test/demo)' : 'real calls'} · actually billed (paid key)</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{inr(totals.billed)}</div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>At paid prices (if there were no free tier): <b>{inr(totals.usd)}</b> · avg per call {rows.length ? inr(totals.usd / rows.length) : '—'}</div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Where the cost goes (by task)</div>
          {totals.byTask.map(([task, t]) => (
            <div key={task} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
              <span style={{ width: 150 }}>{TASK_LABEL[task] ?? task}</span><Bar value={t.usd} max={maxTask} /><b>{inr(t.usd)}</b>
              <span style={{ color: '#6b7280' }}>{totals.usd ? Math.round((100 * t.usd) / totals.usd) : 0}%</span>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Tokens by kind</div>
          {Object.entries(totals.byModality).map(([m, n]) => (
            <div key={m} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
              <span style={{ width: 80 }}>{m}</span><Bar value={n} max={maxMod} /><b>{k(n)}</b>
            </div>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Calls (click a row for its breakdown)</div>
        {!rows.length && <p style={{ color: '#6b7280' }}>No {includeDemo ? '' : 'real '}calls with usage recorded yet. Usage is recorded from now on: make a call on the app and it appears here.</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['Incident', 'Started', 'Channel', 'Severity', 'Requests', 'Tokens', 'At paid prices', 'Biggest task'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const tasks = Object.entries(r.usage).map(([task, u]) => ({ task, u, usd: estimateCostUsd(u) })).sort((a, b) => b.usd - a.usd)
                const usd = tasks.reduce((s, t) => s + t.usd, 0)
                return [
                  <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: 'pointer', background: open === r.id ? '#fff7ed' : undefined }}>
                    <td style={td}><b>{r.id}</b>{r.demo && <span style={{ marginLeft: 6, fontSize: 10, background: '#7c3aed', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>DEMO</span>}</td>
                    <td style={td}>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                    <td style={td}>{r.channel}</td>
                    <td style={td}>{r.severity}</td>
                    <td style={td}>{tasks.reduce((s, t) => s + (t.u.requests ?? 0), 0)}</td>
                    <td style={td}>{k(tasks.reduce((s, t) => s + tokens(t.u), 0))}</td>
                    <td style={td}><b>{inr(usd)}</b></td>
                    <td style={td}>{tasks[0] ? `${TASK_LABEL[tasks[0].task] ?? tasks[0].task} (${usd ? Math.round((100 * tasks[0].usd) / usd) : 0}%)` : '—'}</td>
                  </tr>,
                  open === r.id && (
                    <tr key={`${r.id}-d`}><td colSpan={8} style={{ padding: 8, background: '#fafafa' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead><tr>{['Task', 'Model', 'Key', 'Requests', 'Text in', 'Audio in', 'Camera in', 'Text out', 'Voice out', 'Time', 'At paid prices', 'Share'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>{tasks.map(({ task, u, usd: c }) => (
                          <tr key={task}>
                            <td style={td}>{TASK_LABEL[task] ?? task}</td><td style={td}><code>{u.model}</code></td><td style={td}>{u.tier ?? '—'}</td>
                            <td style={td}>{u.requests ?? 0}</td><td style={td}>{k(u.inText ?? 0)}</td><td style={td}>{k(u.inAudio ?? 0)}</td><td style={td}>{k(u.inImage ?? 0)}</td>
                            <td style={td}>{k(u.outText ?? 0)}</td><td style={td}>{k(u.outAudio ?? 0)}</td><td style={td}>{u.ms ? `${(u.ms / 1000).toFixed(1)} s` : '—'}</td>
                            <td style={td}><b>{inr(c)}</b></td><td style={td}>{usd ? Math.round((100 * c) / usd) : 0}%</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </td></tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
