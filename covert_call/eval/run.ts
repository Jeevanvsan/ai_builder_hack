// AI accuracy test (Epic 28): runs every scenario as a real Gemini Live call with Mia's actual persona and tools,
// against a simulated caller (a second Gemini model playing the person on the phone), then scores what reached
// the dashboard. Writes eval/results/latest.json for the report.
//
// Run:  npx tsx eval/run.ts            (all scenarios)
//       npx tsx eval/run.ts covert-weapon open-fire   (just these)
// Needs GEMINI_API_KEY (or VITE_GEMINI_LIVE_API_KEY in web/.env.local). Runs locally only; nothing is deployed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { GoogleGenAI, Modality, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import { affirmed } from '../shared/incidents/severity.ts'
import { PERSONA_SYSTEM_INSTRUCTION } from '../web/src/lib/gemini/persona.ts'
import { LIVE_CALL_TOOLS } from '../web/src/lib/gemini/tools.ts'
import { CATEGORY_PATTERNS, SCENARIOS, type Category, type Scenario } from './scenarios.ts'

const LIVE_MODEL = 'gemini-3.8-live'
const CALLER_MODEL = 'gemini-3.5-flash'
const MAX_TURNS = 9
const TURN_TIMEOUT_MS = 45_000
const PARALLEL = 3

function apiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  try {
    const env = readFileSync(new URL('../web/.env.local', import.meta.url), 'utf8')
    const m = env.match(/^VITE_GEMINI_LIVE_API_KEY=(.+)$/m)
    if (m?.[1].trim()) return m[1].trim()
  } catch { /* fall through */ }
  throw new Error('Set GEMINI_API_KEY (kept local, never committed).')
}
const ai = new GoogleGenAI({ apiKey: apiKey() })

type Line = { who: 'mia' | 'caller'; text: string; at: number }
type ToolEvent = { name: string; args: Record<string, unknown>; at: number }
export type Result = {
  id: string; group: Scenario['group']; language: string
  transcript: Line[]; tools: ToolEvent[]
  checks: { name: string; pass: boolean; detail: string }[]
  firstAlertS: number | null; durationS: number; turns: number; error?: string
}

// The simulated caller: sees only its brief and what Mia said, and answers like a real person would.
async function callerReply(s: Scenario, transcript: Line[]): Promise<string> {
  const convo = transcript.map((l) => `${l.who === 'mia' ? 'MIA' : 'YOU'}: ${l.text}`).join('\n')
  const r = await ai.models.generateContent({
    model: CALLER_MODEL,
    contents: `You are role-playing a phone caller in a safety-app test. Stay in role.
YOUR SITUATION (secret): ${s.brief}
Language: ${s.language}.
Rules: reply with ONLY your next spoken line (1-2 short sentences, the way people talk on the phone). Answer
what Mia just asked. If Mia says goodbye or the order is done, reply exactly [HANGUP].

Conversation so far:
${convo}

YOUR NEXT LINE:`,
  })
  return (r.text ?? '').trim().replace(/^YOU:\s*/i, '')
}

// One live call. Mia's words come back as audio; outputAudioTranscription gives us her text.
async function runCall(s: Scenario): Promise<Result> {
  const transcript: Line[] = []
  const tools: ToolEvent[] = []
  const t0 = Date.now()
  let miaBuf = ''
  let turnDone: (() => void) | null = null
  let ended = false

  const onMessage = (m: LiveServerMessage, session: Session) => {
    const sc = m.serverContent
    if (sc?.outputTranscription?.text) miaBuf += sc.outputTranscription.text
    if (sc?.turnComplete) {
      if (miaBuf.trim()) transcript.push({ who: 'mia', text: miaBuf.trim().replace(/\s+/g, ' '), at: Date.now() - t0 })
      miaBuf = ''
      turnDone?.()
    }
    const calls: FunctionCall[] = m.toolCall?.functionCalls ?? []
    if (calls.length) {
      for (const c of calls) {
        tools.push({ name: c.name ?? '', args: (c.args ?? {}) as Record<string, unknown>, at: Date.now() - t0 })
        if (c.name === 'end_call') ended = true
      }
      session.sendToolResponse({
        functionResponses: calls.map((c) => ({
          id: c.id, name: c.name,
          response: { output: c.name === 'get_route_guidance'
            ? 'Nearest police station: Central Police Station, 600 m. Next step: walk straight 200 m towards the main road, then turn left.'
            : 'ok' },
        })),
      })
    }
  }

  let session!: Session
  const waitTurn = () => new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, TURN_TIMEOUT_MS)
    turnDone = () => { clearTimeout(timer); turnDone = null; resolve() }
  })
  try {
    const opened = new Promise<void>((resolve, reject) => {
      ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          outputAudioTranscription: {},
          systemInstruction: PERSONA_SYSTEM_INSTRUCTION,
          tools: LIVE_CALL_TOOLS,
        },
        callbacks: {
          onopen: () => resolve(),
          onmessage: (m) => onMessage(m, session),
          onerror: (e) => reject(e),
          onclose: () => { ended = true; turnDone?.() },
        },
      }).then((x) => { session = x }, reject)
    })
    await opened
    while (!session) await new Promise((r) => setTimeout(r, 20))

    let w = waitTurn()
    session.sendClientContent({ turns: 'The call has just connected. Greet the caller now, as instructed.' })
    await w
    let turns = 0
    while (!ended && turns < MAX_TURNS) {
      const line = await callerReply(s, transcript)
      if (!line || line.includes('[HANGUP]')) break
      transcript.push({ who: 'caller', text: line, at: Date.now() - t0 })
      turns++
      w = waitTurn()
      session.sendClientContent({ turns: line })
      await w
    }
    session.close()
    return score(s, transcript, tools, Date.now() - t0, turns)
  } catch (e) {
    try { session?.close() } catch { /* already closed */ }
    return { ...score(s, transcript, tools, Date.now() - t0, 0), error: String(e) }
  }
}

const RANK = { low: 0, medium: 1, high: 2 } as const
// Words that would give the cover away if Mia said them out loud during a covert call.
const LEAK = /\b(police|ambulance|112|100|emergency services|cops?|dispatcher|helpline)\b/i
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase()

function score(s: Scenario, transcript: Line[], tools: ToolEvent[], ms: number, turns: number): Result {
  const reports = tools.filter((t) => t.name === 'report_situation')
  const tags = reports.flatMap((t) => (Array.isArray(t.args.dangerIndicators) ? t.args.dangerIndicators as string[] : []))
  const live = affirmed(tags) // what the dashboard counts after the "no weapon" filter
  const has = (c: Category) => live.some((t) => CATEGORY_PATTERNS[c].test(t))
  const urgency = reports.map((t) => t.args.urgency as keyof typeof RANK).filter((u) => u in RANK)
    .reduce<keyof typeof RANK | null>((a, u) => (!a || RANK[u] > RANK[a] ? u : a), null)
  const checks: Result['checks'] = []
  const e = s.expect

  for (const c of e.categories ?? []) checks.push({ name: `detects ${c}`, pass: has(c), detail: live.join('; ') || 'no tags' })
  for (const c of e.forbidden ?? []) {
    const hit = live.filter((t) => CATEGORY_PATTERNS[c].test(t))
    checks.push({ name: `no false ${c}`, pass: hit.length === 0, detail: hit.join('; ') || 'none' })
  }
  if (e.urgency) checks.push({ name: `urgency ≥ ${e.urgency}`, pass: !!urgency && RANK[urgency] >= RANK[e.urgency], detail: urgency ?? 'not reported' })
  if (e.address) {
    const addr = tools.filter((t) => t.name === 'confirm_address').map((t) => String(t.args.address))
    checks.push({ name: 'address captured', pass: addr.some((a) => a.toLowerCase().includes(e.address!.toLowerCase())), detail: addr.join(' | ') || 'not captured' })
  }
  if (e.plate) {
    const plates = tools.filter((t) => t.name === 'report_vehicle_number').map((t) => String(t.args.number ?? t.args.plate ?? ''))
    checks.push({ name: 'plate captured', pass: plates.some((p) => norm(p) === norm(e.plate!)), detail: plates.join(' | ') || 'not captured' })
  }
  if (e.coercion !== undefined) {
    const n = tools.filter((t) => t.name === 'report_coercion_signal').length
    checks.push({ name: e.coercion ? 'coercion flagged' : 'no false coercion', pass: e.coercion ? n > 0 : n === 0, detail: `${n} signal(s)` })
  }
  if (e.covert) {
    const leaks = transcript.filter((l) => l.who === 'mia' && LEAK.test(l.text)).map((l) => l.text.match(LEAK)![0])
    checks.push({ name: 'cover kept', pass: leaks.length === 0, detail: leaks.length ? `said "${leaks.join('", "')}"` : 'no giveaway words' })
  }
  if (e.benign) checks.push({ name: 'no false alarm', pass: live.length === 0, detail: live.join('; ') || 'no danger tags' })

  const firstDanger = reports.find((t) => affirmed((t.args.dangerIndicators as string[] | undefined) ?? []).length)
  const firstCaller = transcript.find((l) => l.who === 'caller')
  return {
    id: s.id, group: s.group, language: s.language, transcript, tools, checks,
    firstAlertS: firstDanger && firstCaller ? Math.max(0, Math.round((firstDanger.at - firstCaller.at) / 100) / 10) : null,
    durationS: Math.round(ms / 100) / 10, turns,
  }
}

const only = process.argv.slice(2)
const todo = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS
const results: Result[] = []
let next = 0
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (next < todo.length) {
    const s = todo[next++]
    const r = await runCall(s)
    results.push(r)
    const ok = r.checks.filter((c) => c.pass).length
    console.log(`${r.error ? '✗' : ok === r.checks.length ? '✓' : '•'} ${s.id.padEnd(24)} ${ok}/${r.checks.length} checks · ${r.turns} turns · ${r.durationS}s${r.error ? ` · ${r.error.slice(0, 80)}` : ''}`)
  }
}))

results.sort((a, b) => SCENARIOS.findIndex((s) => s.id === a.id) - SCENARIOS.findIndex((s) => s.id === b.id))
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
const out = { ranAt: new Date().toISOString(), liveModel: LIVE_MODEL, callerModel: CALLER_MODEL, results }
writeFileSync(new URL('./results/latest.json', import.meta.url), JSON.stringify(out, null, 2))
const all = results.flatMap((r) => r.checks)
console.log(`\n${all.filter((c) => c.pass).length}/${all.length} checks passed across ${results.length} calls → eval/results/latest.json`)
process.exit(0)
