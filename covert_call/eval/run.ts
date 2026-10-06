// AI accuracy + performance test (Epic 28): runs every scenario as a real Gemini Live call with Mia's actual
// persona and tools, against a simulated caller (a second Gemini model playing the person on the phone), and
// writes every call as a real incident (demoIncidents collection, so the live queue stays clean) through the same
// shared client the app uses. Scores what reached the dashboard and measures latency at each step.
// Writes eval/results/latest.json; report.py turns it into the Excel report.
//
// Run (from covert_call/eval/):  npm run test:ai                         (all scenarios), then npm run report
//                                npm run test:ai -- chase-open-to-covert (just these)
//                                npm run test:ai -- --no-record          (no Firestore incidents)
// Needs GEMINI_API_KEY (or VITE_GEMINI_LIVE_API_KEY) and the Firebase web config (VITE_FIREBASE_*) in
// eval/.env.local or web/.env.local. Runs locally only; nothing is deployed.
//
// Mocks: `gps` scenarios get a fake navigator.geolocation that moves one fix per caller turn, so the app's real
// live-tracking/routing code (web/src/lib/nav/liveTracking.ts) runs on it. `media` streams JPEG frames (~1 fps)
// and 16 kHz PCM sound into the call the way frames.ts / audio.ts do. `silent` runs the SOS observer.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { GoogleGenAI, MediaResolution, Modality, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import { arrayUnion, doc, getDoc, onSnapshot, terminate, updateDoc, type Firestore } from 'firebase/firestore'
import { apiKey, db as webDb, setDemo } from './firebaseNode.ts'
import { runPostCall, type PostCallMetrics } from './postcall.ts'
import {
  appendTranscriptLine, confirmAddress, endIncident, recordAiUsage, INCIDENTS, recordCoercionSignal, recordAdvice, recordVehicleNumber,
  recordVoiceStress, reportSceneObservation, startIncident, updateLiveFields,
} from '../shared/incidents/client.ts'
import { affirmed } from '../shared/incidents/severity.ts'
import { knownFactsNote } from '../shared/incidents/knownFacts.ts'
import type { Incident } from '../shared/incidents/types.ts'
import { PERSONA_SYSTEM_INSTRUCTION, SILENT_OBSERVER_INSTRUCTION } from '../web/src/lib/gemini/persona.ts'
import { LIVE_CALL_TOOLS, REPORT_SCENE_OBSERVATION_TOOLS, batchResponses } from '../web/src/lib/gemini/tools.ts'
import { startLiveTracking, type LiveTracker } from '../web/src/lib/nav/liveTracking.ts'
import { AI_MODELS, usageFromMetadata } from '../shared/aiModels.ts'
import { CATEGORY_PATTERNS, SCENARIOS, type Category, type MediaCue, type Scenario } from './scenarios.ts'

const LIVE_MODEL = AI_MODELS.liveCall
// The simulated caller. Free-tier daily quotas are per model (gemini-3.5-flash allows only 20 requests/day), so
// a model that runs out for the day is dropped and the next one takes over.
// Cost: Gemma is free on the Gemini API (14.4K requests/day), so the simulated caller and the judge run on it;
// paid Flash models are only a fallback if Gemma is unavailable.
// Flash-Lite first: Gemma is free but took ~165 s per caller line in testing, which made every call crawl.
const CALLER_MODELS = [AI_MODELS.evalCaller, 'gemma-4-31b-it'] as string[] // shared/aiModels.ts, then fallbacks
// The judge reads the dashboard data and decides whether it conveys each expected fact (semantic check).
const JUDGE_MODELS = [AI_MODELS.evalJudge, 'gemini-3.1-flash-lite'] as string[]
// (Text-only replies were tried to save cost, but the Live model only answers in audio; see textMode below.)
const callerModels = [...CALLER_MODELS]
const judgeModels = [...JUDGE_MODELS]
const CALLER_MODEL = CALLER_MODELS.join(' → ')
const REPEAT = Math.max(1, Number(process.argv.find((a) => a.startsWith('--repeat='))?.split('=')[1] ?? 1))
// A call ends as soon as every check has passed (often well under a minute); these are only the upper bounds.
const MAX_TURNS = 8
const MAX_CALL_MS = 150_000
const MIN_TURNS = 3 // never stop before the caller has said a few lines
const NEGATIVE_ONLY_TURNS = 6 // calls that only check nothing false was raised run this long
const TURN_TIMEOUT_MS = 45_000
const PARALLEL = 1 // one call at a time: stays under the free-tier rate limit
const RECORD = !process.argv.includes('--no-record')
// After each call the test incident is resolved (as a responder, like the dashboard's Resolve) unless --keep-open.
const RESOLVE = RECORD && !process.argv.includes('--keep-open') && !!process.env.RESPONDER_EMAIL && !!process.env.RESPONDER_PASSWORD
const MEDIA = new URL('./media/', import.meta.url)

// Free-tier key only: register.mjs puts GEMINI_API_KEY_FREE into GEMINI_API_KEY and ignores any paid key.
const FREE_KEY = process.env.GEMINI_API_KEY_FREE
const aiPaid = new GoogleGenAI({ apiKey })
const aiFree = FREE_KEY ? new GoogleGenAI({ apiKey: FREE_KEY }) : null
// Per model (text) and for Live: which tier to use right now. Flips to 'paid' after a quota error on free.
const tierFor = new Map<string, 'free' | 'paid'>()
// Without a second key there is only the free one (register.mjs), so the single client IS the free tier.
const tier = (model: string) => (aiFree ? tierFor.get(model) ?? 'free' : 'free')
const client = (model: string) => (tier(model) === 'free' && aiFree ? aiFree : aiPaid)
export const keyUsage = { free: 0, paid: 0, liveFree: 0, livePaid: 0 }
const QUOTA = /RESOURCE_EXHAUSTED|429|quota/i

// The web app's own Firebase app (see firebaseNode.ts); test calls land in demoIncidents, never the live queue.
const db: Firestore | null = RECORD ? webDb : null
if (RECORD) setDemo()
if (RESOLVE) {
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
  const { getApp } = await import('firebase/app')
  await signInWithEmailAndPassword(getAuth(getApp()), process.env.RESPONDER_EMAIL!, process.env.RESPONDER_PASSWORD!)
} else if (RECORD && !process.argv.includes('--keep-open')) {
  console.log('No RESPONDER_EMAIL/RESPONDER_PASSWORD in eval/.env.local: test incidents stay open in the queue.')
}

// ---- Fake GPS: one owner at a time (gps scenarios run alone, before the parallel batch)
type Fix = { lat: number; lng: number }
let gpsFix: Fix | null = null
const watchers = new Map<number, (p: GeolocationPosition) => void>()
let watchSeq = 0
const position = (f: Fix) => ({
  coords: { latitude: f.lat, longitude: f.lng, accuracy: 8, speed: 1.6, altitude: null, altitudeAccuracy: null, heading: null },
  timestamp: Date.now(),
}) as unknown as GeolocationPosition
Object.defineProperty(globalThis.navigator, 'geolocation', {
  configurable: true,
  value: {
    // Callbacks fire async, like a real browser (liveTracking declares state after calling watchPosition).
    getCurrentPosition: (ok: PositionCallback, err?: PositionErrorCallback) => setTimeout(() =>
      gpsFix ? ok(position(gpsFix)) : err?.({ code: 2, message: 'no GPS in test' } as GeolocationPositionError), 50),
    watchPosition: (ok: PositionCallback) => {
      const id = ++watchSeq
      watchers.set(id, ok)
      if (gpsFix) { const f = gpsFix; setTimeout(() => watchers.has(id) && ok(position(f)), 50) }
      return id
    },
    clearWatch: (id: number) => watchers.delete(id),
  },
})
const moveTo = (f: Fix) => { gpsFix = f; for (const cb of watchers.values()) cb(position(f)) }

// ---- Types
type Line = { who: 'mia' | 'caller' | 'system'; text: string; at: number }
type ToolEvent = { name: string; args: Record<string, unknown>; at: number }
type Turn = { turn: number; sentAt: number; firstAudioMs: number | null; completeMs: number | null; words: number }
export type Metrics = {
  incidentCreateMs: number | null // startIncident() round trip: how fast the dashboard gets the alert
  connectMs: number | null // Live session open
  greetingFirstAudioMs: number | null // greeting nudge → Mia's first audio chunk
  avgResponseMs: number | null; p50ResponseMs: number | null; p95ResponseMs: number | null; maxResponseMs: number | null
  firstToolS: number | null // call start → first tool call
  firstDangerS: number | null // first caller line → first affirmed danger tag
  addressS: number | null // call start → confirm_address
  routeGuidanceMs: number | null // avg get_route_guidance answer time (real routing)
  writeAvgMs: number | null; writeP95Ms: number | null; writes: number; writeErrors: number // Firestore writes
  toolCalls: number
  promptTokens: number | null; responseTokens: number | null; totalTokens: number | null
  framesSent: number; audioSentS: number
  spokenChunks: number // audio chunks Mia played (silent SOS must be 0)
  processedTokens: number // sum over every model inference in the call (what the TPM limit and the bill see)
  inferences: number // how many times the model re-processed the session
  postCall: PostCallMetrics | null // case summary, grounded context, linked cases (as CallPage does on hang-up)
}
export type Result = {
  id: string; title: string; features: string; group: Scenario['group']; language: string; mocks: string; expected: string
  incidentId: string | null
  transcript: Line[]; tools: ToolEvent[]; turnTimings: Turn[]
  // pass = strict (keyword) result; semantic = the AI judge's verdict on the dashboard data; atS = when it was detected
  checks: { name: string; pass: boolean; detail: string; semantic?: boolean; judge?: string; atS?: number | null }[]
  run: number; attempts: number; keyTier?: 'free' | 'paid'; outputMode?: 'text' | 'audio'
  dashboard: { callState: string | null; responseStatus: string | null; severity: string | null; urgency: string | null; dangerIndicators: string[]; peopleCount: number | null; voiceStress: number | null; trackPoints: number; route: string | null; sceneObservations: number }
  metrics: Metrics
  firstAlertS: number | null; durationS: number; turns: number; error?: string
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const secs = (ms: number | null | undefined) => (ms == null ? null : Math.round(ms / 100) / 10)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Text model calls with a model chain: out of daily quota → drop that model; overloaded (503) twice in a row →
// rotate it to the back; other transient errors → back off and retry.
async function generate(models: string[], contents: string, tries = 8): Promise<string> {
  let overloaded = 0
  for (let i = 0; ; i++) {
    try {
      const m = models[0]
      const t = tier(m)
      const r = await client(m).models.generateContent({ model: m, contents })
      keyUsage[t]++
      return (r.text ?? '').trim()
    } catch (e) {
      const msg = String(e)
      // Free tier out of quota for this model: same model on the paid key, straight away.
      if (aiFree && tier(models[0]) === 'free' && QUOTA.test(msg)) { tierFor.set(models[0], 'paid'); console.log(`  ${models[0]}: free tier exhausted → paid key`); continue }
      if (/PerDay/.test(msg) && models.length > 1) { console.log(`  ${models.shift()} is out of daily quota → ${models[0]}`); continue }
      if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg) && ++overloaded >= 2 && models.length > 1) { models.push(models.shift()!); overloaded = 0; continue }
      if (i >= tries - 1 || !/(500|503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|fetch failed)/i.test(msg)) throw e
      await sleep(Math.min(30_000, 2_000 * 2 ** i))
    }
  }
}
// Live sessions get overloaded too (503 on connect) and the network can drop: the whole call is retried.
const transient = (e: unknown) => /503|UNAVAILABLE|overloaded|high demand|fetch failed|ECONNRESET|ETIMEDOUT/i.test(String(e))
const normLine = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// The simulated caller: sees only its brief and what Mia said, and answers like a real person would.
async function callerReply(s: Scenario, transcript: Line[]): Promise<string> {
  const convo = transcript.filter((l) => l.who !== 'system').map((l) => `${l.who === 'mia' ? 'MIA' : 'YOU'}: ${l.text}`).join('\n')
  const said = transcript.filter((l) => l.who === 'caller').map((l) => l.text)
  const prompt = (extra: string) => `You are the CALLER on a phone call to a food-delivery line. "Mia" answers. Play the caller.

YOUR SITUATION (secret, it is happening to you): ${s.brief}
LANGUAGE: ${s.language}

HOW TO ANSWER
1. Speak as yourself, in the first person: "I", "me", "myself". Mia says "you"; you never do about yourself.
   Mia: "Is this for yourself or someone else?" -> You: "For myself."
2. Pick from the options Mia gives, in her words, converted to your point of view
   ("for yourself" -> "for myself"). Answer only what she just asked.
3. Bring in the facts of your situation as her questions allow, one or two per reply (covert: only through
   her food choices). No small talk.
4. One short line, 1-2 sentences, spoken words only. No narration, quotes or labels.
5. Never repeat an earlier line. If she asked nothing new, give your next fact or say "still here".
6. If she says goodbye or the order is complete, reply exactly: [HANGUP]
${extra}
CALL SO FAR (MIA = her, YOU = you):
${convo || '(Mia has only greeted you)'}

YOUR LINE (reply #${said.length + 1}):`
  const clean = (t: string) => t.replace(/^YOU:\s*/i, '').replace(/^["“]|["”]$/g, '').trim()
  let line = clean(await generate(callerModels, prompt('')))
  // A looping caller makes the test meaningless: regenerate once if it repeats itself.
  if (said.some((x) => normLine(x) === normLine(line))) {
    line = clean(await generate(callerModels, prompt(`- You were about to say "${line}" again. Say something NEW instead.`)))
  }
  return line
}

// Semantic judge for checks a keyword pattern can miss ("restraining victim" = confined). The strict result is
// kept as it is; this only adds a second, clearly labelled verdict.
async function judge(fact: string, evidence: string): Promise<{ pass: boolean; why: string }> {
  const out = await generate(judgeModels, `You audit an emergency-response dashboard. Answer strictly.
EXPECTED FACT: ${fact}
WHAT THE DASHBOARD SHOWS:
${evidence}
Does the dashboard data clearly convey the expected fact (same meaning, any wording)? Reply as JSON only:
{"pass": true or false, "why": "<one short sentence>"}`).catch(() => '')
  try {
    const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as { pass: boolean; why: string }
    return { pass: !!j.pass, why: String(j.why ?? '') }
  } catch { return { pass: false, why: 'judge unavailable' } }
}

const MOVEMENT = /(followed|chased|chasing|stalked|stalking|fleeing|escaping)|following (me|her|him|them|the caller)|on the move|moving around|abduct|taken somewhere|running away|in the road|leaving the (house|home|room|building)/i

function frameFiles(folder: string) {
  const dir = new URL(`${folder}/`, MEDIA)
  return readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => readFileSync(new URL(f, dir)).toString('base64'))
}

// One call (or one silent SOS). Mia's words come back as audio; outputAudioTranscription gives us her text.
async function runCall(s: Scenario): Promise<Result> {
  const transcript: Line[] = []
  const tools: ToolEvent[] = []
  const turnTimings: Turn[] = []
  const writeMs: number[] = []
  const routeMs: number[] = []
  let writeErrors = 0
  let incidentId: string | null = null
  let incidentCreateMs: number | null = null
  let connectMs: number | null = null
  let greetingFirstAudioMs: number | null = null
  let usage = { prompt: 0, response: 0, total: 0 }
  let processed = 0
  let inferences = 0
  const liveTask = { inText: 0, inAudio: 0, inImage: 0, outText: 0, outAudio: 0 } // → incident.aiUsage, like the app
  let framesSent = 0
  let audioSentMs = 0
  let spokenChunks = 0
  let spokeSinceCaller = false
  let routesServed = 0
  let movementReported = false
  let tracker: LiveTracker | null = null
  let unsubFacts: (() => void) | null = null
  const t0 = Date.now()

  // Every write to this incident strictly sequential (same as the app), and timed.
  let writeQueue: Promise<unknown> = Promise.resolve()
  const enqueueWrite = (write: (db: Firestore, id: string) => Promise<unknown>) => {
    if (!db || !incidentId) return
    const d = db, id = incidentId
    const run = async () => {
      const w0 = Date.now()
      try { await write(d, id); writeMs.push(Date.now() - w0) } catch { writeErrors++ }
    }
    writeQueue = writeQueue.then(run, run)
  }

  if (s.gps?.length) moveTo(s.gps[0])
  if (db) {
    const c0 = Date.now()
    const started = await startIncident(db, s.silent
      ? { channel: 'silent-sos', incidentType: 'sos', scenario: 'hostage', severity: 'high' }
      : { channel: 'live-call' })
    incidentId = started.id
    incidentCreateMs = Date.now() - c0
  }

  let miaBuf = ''
  let turnDone: (() => void) | null = null
  let currentTurn: Turn | null = null
  let ended = false
  let session!: Session

  const answer = (call: FunctionCall): string | Promise<string> => {
    const args = (call.args ?? {}) as Record<string, unknown>
    switch (call.name) {
      case 'report_situation': {
        const patch: Record<string, unknown> = {}
        if (typeof args.peopleCount === 'number') patch.peopleCount = args.peopleCount
        if (Array.isArray(args.dangerIndicators)) patch.dangerIndicators = args.dangerIndicators
        if (typeof args.urgency === 'string') patch.urgency = args.urgency
        if (typeof args.notes === 'string') patch.notes = args.notes
        if (Array.isArray(args.dangerIndicators) && args.dangerIndicators.some((t) => typeof t === 'string' && MOVEMENT.test(t))) movementReported = true
        enqueueWrite((d, id) => updateLiveFields(d, id, patch))
        return 'ok'
      }
      case 'confirm_address': {
        if (typeof args.address === 'string') enqueueWrite((d, id) => confirmAddress(d, id, args.address as string))
        return movementReported
          ? 'Saved. They are on the move — call get_route_guidance now and guide them to the police station/hospital it gives.'
          : 'Saved. Do NOT give directions — they have not said they are being followed or moving. Keep them safe where they are.'
      }
      case 'report_stress_level':
        if (typeof args.score === 'number') enqueueWrite((d, id) => recordVoiceStress(d, id, Math.max(0, Math.min(100, args.score as number))))
        return 'ok'
      case 'report_scene_observation':
        if ((args.source === 'camera' || args.source === 'sound') && typeof args.kind === 'string') {
          enqueueWrite((d, id) => reportSceneObservation(d, id, {
            source: args.source as 'camera' | 'sound', kind: args.kind as string,
            detail: typeof args.detail === 'string' ? args.detail : undefined,
            confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
            category: typeof args.category === 'string' ? args.category : undefined,
            vehicle: { type: args.vehicleType as string | undefined, colour: args.colour as string | undefined, plate: args.plate as string | undefined },
          }))
        }
        return 'ok'
      case 'report_advice':
        if (typeof args.text === 'string' && args.text.trim()) enqueueWrite((d, id) => recordAdvice(d, id, args.text as string))
        return 'ok'
      case 'report_vehicle_number':
        if (typeof args.plate === 'string' && args.plate.trim()) {
          enqueueWrite((d, id) => recordVehicleNumber(d, id, { value: args.plate as string, source: args.source === 'camera' ? 'camera' : 'caller', confidence: typeof args.confidence === 'number' ? args.confidence : undefined }))
        }
        return 'ok'
      case 'report_coercion_signal':
        if (typeof args.kind === 'string') {
          enqueueWrite((d, id) => recordCoercionSignal(d, id, { kind: args.kind as string, detail: typeof args.detail === 'string' ? args.detail : undefined, confidence: typeof args.confidence === 'number' ? args.confidence : undefined }))
        }
        return 'ok'
      case 'get_route_guidance': {
        if (typeof args.situation === 'string' && MOVEMENT.test(args.situation)) movementReported = true
        if (!movementReported) return 'NOT needed: the caller has not said they are being followed, chased or on the move. Do NOT give any directions or mention a route.'
        routesServed++
        if (!tracker) return 'Nearest police station: Central Police Station, 600 m. Next step: walk straight 200 m towards the main road, then turn left.'
        const r0 = Date.now()
        return tracker.guidance(args.situation as string | undefined, args.landmark as string | undefined)
          .catch(() => 'Routing is unavailable right now — ask for the nearest landmark and keep them moving somewhere busy and lit.')
          .finally(() => routeMs.push(Date.now() - r0))
      }
      case 'end_call':
        ended = true
        return 'ok'
      default:
        return 'ok'
    }
  }

  const onMessage = (m: LiveServerMessage) => {
    const sc = m.serverContent
    if (sc?.outputTranscription?.text) miaBuf += sc.outputTranscription.text
    // Text mode: Mia's words arrive as text parts (no transcription step).
    const textOut = sc?.modelTurn?.parts?.map((p) => (p.thought ? '' : p.text ?? '')).join('') ?? ''
    if (textOut) miaBuf += textOut
    const audio = sc?.modelTurn?.parts?.some((p) => p.inlineData?.mimeType?.startsWith('audio/')) || !!textOut
    if (audio) {
      spokeSinceCaller = true
      spokenChunks++
      if (currentTurn && currentTurn.firstAudioMs == null) currentTurn.firstAudioMs = Date.now() - t0 - currentTurn.sentAt
    }
    if (sc?.turnComplete) {
      // Same speech-to-text markers the app strips (liveSession.ts NON_SPEECH_TOKEN).
      const text = miaBuf.replace(/[<{[(]\s*(no speech|pause|silen(ce|t)|inaudible|(background )?noise|static|music|breathing|coughs?|laughs?|sighs?)\s*[>}\])]|-{2,}/gi, ' ').trim().replace(/\s+/g, ' ')
      if (text) {
        transcript.push({ who: 'mia', text, at: Date.now() - t0 })
        enqueueWrite((d, id) => appendTranscriptLine(d, id, 'Mia', text))
      }
      if (currentTurn) { currentTurn.completeMs = Date.now() - t0 - currentTurn.sentAt; currentTurn.words = text.split(/\s+/).filter(Boolean).length }
      miaBuf = ''
      turnDone?.()
    }
    const u = m.usageMetadata
    // Peak context (max) AND total processed: every model inference reports its own usage, so the sum over the call
    // is what the per-minute limit and the bill count (each re-read of the session adds a full context's worth).
    if (u) {
      usage = { prompt: Math.max(usage.prompt, u.promptTokenCount ?? 0), response: Math.max(usage.response, u.responseTokenCount ?? 0), total: Math.max(usage.total, u.totalTokenCount ?? 0) }
      processed += u.totalTokenCount ?? 0
      inferences++
      const m = usageFromMetadata(u as never)
      for (const k of Object.keys(m) as (keyof typeof m)[]) liveTask[k] += m[k]
    }
    const calls: FunctionCall[] = m.toolCall?.functionCalls ?? []
    for (const c of calls) {
      tools.push({ name: c.name ?? '', args: (c.args ?? {}) as Record<string, unknown>, at: Date.now() - t0 })
      void Promise.resolve(answer(c)).then((output) => {
        try { session.sendToolResponse({ functionResponses: batchResponses([c], [output], spokeSinceCaller) }) } catch { /* closed */ }
      })
    }
  }

  const waitTurn = (ms = TURN_TIMEOUT_MS) => new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    turnDone = () => { clearTimeout(timer); turnDone = null; resolve() }
  })
  // Known-facts note (Epic 22.2), as the app sends it: only while Mia is silent (between turns), at most every 8 s.
  // Pushing it mid-sentence interrupts her, which cut her questions off in an earlier version of this harness.
  let pendingFacts = ''
  let lastFactsAt = 0
  const flushFacts = () => {
    if (!pendingFacts || Date.now() - lastFactsAt < 8_000) return
    try { session.sendClientContent({ turns: pendingFacts, turnComplete: false }) } catch { /* closed */ }
    pendingFacts = ''
    lastFactsAt = Date.now()
  }
  const send = (turn: number, text: string) => {
    flushFacts()
    currentTurn = { turn, sentAt: Date.now() - t0, firstAudioMs: null, completeMs: null, words: 0 }
    turnTimings.push(currentTurn)
    spokeSinceCaller = false
    session.sendClientContent({ turns: text })
  }

  // Streams one media cue in real time: frames ~1 fps alongside 100 ms audio chunks.
  const stream = async (cue: { frames?: string; audio?: string }, minSeconds = 0) => {
    const frames = cue.frames ? frameFiles(cue.frames) : []
    const pcm = cue.audio ? readFileSync(new URL(cue.audio, MEDIA)) : null
    const CHUNK = 3200 // 100 ms of 16 kHz s16le
    const audioMs = pcm ? Math.ceil(pcm.length / CHUNK) * 100 : 0
    const totalMs = Math.max(minSeconds * 1000, audioMs, frames.length * 1000)
    for (let at = 0; at < totalMs && !ended; at += 100) {
      if (frames.length && at % 2000 === 0) { // 0.5 fps total, like the app's SOS
        session.sendRealtimeInput({ video: { data: frames[(at / 2000) % frames.length], mimeType: 'image/jpeg' } })
        framesSent++
      }
      if (pcm && at < audioMs) {
        session.sendRealtimeInput({ audio: { data: pcm.subarray((at / 100) * CHUNK, (at / 100 + 1) * CHUNK).toString('base64'), mimeType: 'audio/pcm;rate=16000' } })
        audioSentMs += 100
      } else if (pcm || s.silent) {
        // Quiet room tone after the clip so voice activity detection closes the turn.
        session.sendRealtimeInput({ audio: { data: Buffer.alloc(CHUNK).toString('base64'), mimeType: 'audio/pcm;rate=16000' } })
      }
      await sleep(100)
    }
  }

  // The app streams the camera at ~0.5 fps for the whole call, so a camera cue keeps sending frames until hang-up.
  const frameLoops: ReturnType<typeof setInterval>[] = []
  const startFrames = (folder: string) => {
    const frames = frameFiles(folder)
    let k = 0
    const send1 = () => {
      if (ended) return
      try { session.sendRealtimeInput({ video: { data: frames[k++ % frames.length], mimeType: 'image/jpeg' } }); framesSent++ } catch { /* closed */ }
    }
    send1()
    frameLoops.push(setInterval(send1, 2000)) // same cadence as the app (frames.ts FRAMES_PER_SECOND = 0.5)
  }

  let turns = 0
  let error: string | undefined
  const liveTier = tier(LIVE_MODEL)
  // gemini-3.8-live rejects TEXT-only output (close 1007 "response modalities (TEXT) is not supported"), so every
  // call answers in audio; the harness reads Mia's words from the output transcription.
  const textMode = false
  let closeReason = ''
  try {
    const c0 = Date.now()
    const opened = new Promise<void>((resolve, reject) => {
      client(LIVE_MODEL).live.connect({
        model: LIVE_MODEL,
        config: s.silent
          ? {
            responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {},
            systemInstruction: SILENT_OBSERVER_INSTRUCTION, tools: REPORT_SCENE_OBSERVATION_TOOLS, contextWindowCompression: { triggerTokens: '48000', slidingWindow: { targetTokens: '28000' } }, mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          }
          : textMode
            ? { responseModalities: [Modality.TEXT], systemInstruction: PERSONA_SYSTEM_INSTRUCTION, tools: LIVE_CALL_TOOLS, contextWindowCompression: { triggerTokens: '48000', slidingWindow: { targetTokens: '28000' } }, mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW }
            : {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              inputAudioTranscription: {}, outputAudioTranscription: {},
              systemInstruction: PERSONA_SYSTEM_INSTRUCTION, tools: LIVE_CALL_TOOLS, contextWindowCompression: { triggerTokens: '48000', slidingWindow: { targetTokens: '28000' } }, mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
            },
        callbacks: {
          onopen: () => { connectMs = Date.now() - c0; resolve() },
          onmessage: onMessage,
          onerror: (e) => reject(e),
          onclose: (e) => { closeReason = `${e?.code ?? ''} ${e?.reason ?? ''}`; ended = true; turnDone?.() },
        },
      }).then((x) => { session = x }, reject)
    })
    await opened
    while (!session) await sleep(20)
    keyUsage[liveTier === 'free' ? 'liveFree' : 'livePaid']++

    if (db && incidentId && s.gps) {
      tracker = startLiveTracking(db, incidentId, (note) => {
        if (ended || !movementReported) return
        transcript.push({ who: 'system', text: `[nav] ${note}`, at: Date.now() - t0 })
        try { session.sendClientContent({ turns: `(System note, not the caller — live navigation: ${note} If you are guiding the caller to safety, relay the next instruction now, phrased for the situation per your GETTING TO SAFETY rules.)` }) } catch { /* closed */ }
      })
    }
    // What's already known goes back to Mia as context, as in the app (Epic 22.2).
    if (db && incidentId && !s.silent) {
      let last = ''
      unsubFacts = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
        const data = snap.data() as Omit<Incident, 'id'> | undefined
        const note = data ? knownFactsNote(data) : ''
        if (note && note !== last) { last = note; pendingFacts = note }
      })
    }

    if (s.silent) {
      await stream({ frames: s.silent.frames, audio: s.silent.audio }, s.silent.seconds)
      await sleep(4000) // let trailing tool calls land
    } else {
      let w = waitTurn()
      const g0 = Date.now()
      send(0, 'The call has just connected. Greet the caller now, as instructed.')
      await w
      greetingFirstAudioMs = turnTimings[0].firstAudioMs
      void g0
      const cues = (n: number) => (s.media ?? []).filter((c: MediaCue) => c.afterTurn === n)
      const playCue = async (c: MediaCue) => {
        transcript.push({ who: 'system', text: `[media] ${c.frames ? `camera: ${c.frames} (1 fps until hang-up)` : ''}${c.audio ? ` sound: ${c.audio}` : ''}`, at: Date.now() - t0 })
        if (c.frames) startFrames(c.frames)
        if (c.audio) { const mw = waitTurn(15_000); await stream({ audio: c.audio }); await mw }
      }
      for (const c of cues(0)) await playCue(c)
      const lastCue = Math.max(0, ...(s.media ?? []).map((c) => c.afterTurn))
      const e = s.expect
      const negativeOnly = !e.categories?.length && !e.address && !e.plate && !e.scene?.length && !e.route && !e.coercion && !e.urgency && !e.track
      // Early stop: everything this call checks has already passed (end-of-call checks are added after hang-up).
      const done = () => {
        if (turns < (negativeOnly ? NEGATIVE_ONLY_TURNS : MIN_TURNS) || turns <= lastCue) return false
        const provisional = score(s, { transcript, tools, turnTimings, metrics: { spokenChunks } as Metrics, incidentId: null, incident: undefined, routesServed, durationMs: 0, turns })
        return provisional.checks.filter((c) => !c.name.startsWith('GPS track')).every((c) => c.pass)
      }
      while (!ended && turns < MAX_TURNS && Date.now() - t0 < MAX_CALL_MS && !done()) {
        const line = await callerReply(s, transcript)
        if (!line || line.includes('[HANGUP]')) break
        turns++
        if (s.gps) moveTo(s.gps[Math.min(turns, s.gps.length - 1)])
        transcript.push({ who: 'caller', text: line, at: Date.now() - t0 })
        enqueueWrite((d, id) => appendTranscriptLine(d, id, 'Caller', line))
        w = waitTurn()
        send(turns, line)
        await w
        for (const c of cues(turns)) await playCue(c)
      }
    }
    try { session.close() } catch { /* already closed */ }
    if (QUOTA.test(closeReason)) error = `Live closed: ${closeReason}`
  } catch (e) {
    error = String(e)
    try { session?.close() } catch { /* already closed */ }
  }
  frameLoops.forEach(clearInterval)
  tracker?.stop()
  unsubFacts?.()
  await writeQueue
  let incident: Omit<Incident, 'id'> | undefined
  let postCall: PostCallMetrics | null = null
  if (db && incidentId) {
    await recordAiUsage(db, incidentId, s.silent ? 'sosObserver' : 'liveCall', { model: LIVE_MODEL, tier: liveTier, requests: inferences, ...liveTask })
    await endIncident(db, incidentId).catch(() => { writeErrors++ })
    postCall = await runPostCall(db, incidentId).catch(() => null)
    if (RESOLVE) {
      const at = new Date().toISOString()
      await updateDoc(doc(db, INCIDENTS, incidentId), {
        'response.status': 'resolved', 'response.resolvedAt': at,
        'response.notes': arrayUnion({ responderId: process.env.RESPONDER_EMAIL, text: `Auto-resolved by the AI test harness (${s.id}).`, at }),
      }).catch(() => { writeErrors++ })
    }
    incident = (await getDoc(doc(db, INCIDENTS, incidentId))).data() as Omit<Incident, 'id'> | undefined
  }

  const responses = turnTimings.filter((t) => t.turn > 0 && t.firstAudioMs != null).map((t) => t.firstAudioMs!)
  const metrics: Metrics = {
    incidentCreateMs, connectMs, greetingFirstAudioMs,
    avgResponseMs: avg(responses), p50ResponseMs: pct(responses, 50), p95ResponseMs: pct(responses, 95), maxResponseMs: responses.length ? Math.max(...responses) : null,
    firstToolS: tools.length ? secs(tools[0].at) : null,
    firstDangerS: null,
    addressS: secs(tools.find((t) => t.name === 'confirm_address')?.at),
    routeGuidanceMs: avg(routeMs),
    writeAvgMs: avg(writeMs), writeP95Ms: pct(writeMs, 95), writes: writeMs.length, writeErrors,
    toolCalls: tools.length,
    promptTokens: usage.prompt || null, responseTokens: usage.response || null, totalTokens: usage.total || null,
    framesSent, audioSentS: Math.round(audioSentMs / 100) / 10,
    spokenChunks,
    processedTokens: processed,
    inferences,
    postCall,
  }
  const result0 = score(s, { transcript, tools, turnTimings, metrics, incidentId, incident, routesServed, durationMs: Date.now() - t0, turns, error })
  const result = { ...result0, keyTier: liveTier, outputMode: textMode ? 'text' as const : 'audio' as const }
  // Second opinion on content checks a keyword can miss. Evidence = exactly what the dashboard holds.
  const evidence = [
    `Danger tags: ${(incident?.extractedFieldsLive.dangerIndicators ?? []).join('; ') || '-'}`,
    `Notes: ${incident?.extractedFieldsLive.notes ?? '-'}`,
    `Urgency: ${incident?.extractedFieldsLive.urgency ?? '-'}`,
    `Scene observations: ${tools.filter((t) => t.name === 'report_scene_observation').map((t) => `${t.args.source}: ${t.args.kind} ${t.args.detail ?? ''}`).join(' | ') || '-'}`,
    `Coercion signals: ${tools.filter((t) => t.name === 'report_coercion_signal').map((t) => `${t.args.kind} ${t.args.detail ?? ''}`).join(' | ') || '-'}`,
    `Vehicle numbers: ${tools.filter((t) => t.name === 'report_vehicle_number').map((t) => t.args.plate).join(' | ') || '-'}`,
    `Case summary: ${incident?.consolidatedSummary ?? '-'}`,
  ].join(' / ')
  const FACT: Record<string, string> = {
    weapon: 'a weapon is involved', harmed_now: 'the caller is being harmed or threatened right now', followed: 'the caller is being followed or chased',
    abduction: 'the caller is being abducted / taken against their will', confined: 'the caller is confined, locked in, held or restrained',
    injury: 'someone is injured', domestic: 'the abuser is a partner or family member (domestic violence)', crime_witnessed: 'a crime such as theft was witnessed',
    group_violence: 'a group / several people are fighting', child: 'a child is involved or at risk', hazard: 'a hazard such as fire, smoke or a crash',
  }
  for (const c of result.checks) {
    if (c.pass) { c.semantic = true; continue }
    const m = c.name.match(/^detects (\w+)$/)
    const fact = m ? FACT[m[1]] : c.name.startsWith('scene: ') ? `the camera or sound analysis observed: ${c.name.slice(7)}` : c.name === 'coercion flagged' ? 'the caller is being coerced (scripted answers, a second voice, a forced cancel)' : null
    if (!fact || !incident) continue
    const v = await judge(fact, evidence)
    c.semantic = v.pass
    c.judge = v.why
  }
  return result
}

const RANK = { low: 0, medium: 1, high: 2 } as const
// Words that would give the cover away if Mia said them out loud during a covert call.
const LEAK = /\b(police|ambulance|112|100|emergency services|cops?|dispatcher|helpline)\b/i
const STAY = /\b(stay (where you are|put|there|still)|don'?t move)\b/i
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase()

function score(s: Scenario, r: {
  transcript: Line[]; tools: ToolEvent[]; turnTimings: Turn[]; metrics: Metrics; incidentId: string | null
  incident: Omit<Incident, 'id'> | undefined; routesServed: number; durationMs: number; turns: number; error?: string
}): Result {
  const { transcript, tools } = r
  const reports = tools.filter((t) => t.name === 'report_situation')
  const tags = reports.flatMap((t) => (Array.isArray(t.args.dangerIndicators) ? t.args.dangerIndicators as string[] : []))
  const live = affirmed(tags) // what the dashboard counts after the "no weapon" filter
  const has = (c: Category) => live.some((t) => CATEGORY_PATTERNS[c].test(t))
  const urgency = reports.map((t) => t.args.urgency as keyof typeof RANK).filter((u) => u in RANK)
    .reduce<keyof typeof RANK | null>((a, u) => (!a || RANK[u] > RANK[a] ? u : a), null)
  const scenes = tools.filter((t) => t.name === 'report_scene_observation').map((t) => `${t.args.source}: ${t.args.kind} ${t.args.detail ?? ''}`)
  const mia = transcript.filter((l) => l.who === 'mia')
  const checks: Result['checks'] = []
  const e = s.expect

  // When each fact first reached the dashboard (seconds from call start).
  const firstAt = (c: Category) => {
    const t = reports.find((x) => affirmed((x.args.dangerIndicators as string[] | undefined) ?? []).some((d) => CATEGORY_PATTERNS[c].test(d)))
    return t ? secs(t.at) : null
  }
  for (const c of e.categories ?? []) checks.push({ name: `detects ${c}`, pass: has(c), detail: live.join('; ') || 'no tags', atS: firstAt(c) })
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
    const plates = tools.filter((t) => t.name === 'report_vehicle_number').map((t) => String(t.args.plate ?? t.args.number ?? ''))
    checks.push({ name: 'plate captured', pass: plates.some((p) => norm(p) === norm(e.plate!)), detail: plates.join(' | ') || 'not captured' })
  }
  if (e.coercion !== undefined) {
    const n = tools.filter((t) => t.name === 'report_coercion_signal').length
    checks.push({ name: e.coercion ? 'coercion flagged' : 'no false coercion', pass: e.coercion ? n > 0 : n === 0, detail: `${n} signal(s)` })
  }
  if (e.covert) {
    const leaks = mia.filter((l) => LEAK.test(l.text)).map((l) => l.text.match(LEAK)![0])
    checks.push({ name: 'cover kept', pass: leaks.length === 0, detail: leaks.length ? `said "${leaks.join('", "')}"` : 'no giveaway words' })
  }
  if (e.benign) checks.push({ name: 'no false alarm', pass: live.length === 0, detail: live.join('; ') || 'no danger tags' })
  for (const pattern of e.scene ?? []) {
    const re = new RegExp(pattern, 'i')
    checks.push({ name: `scene: ${pattern.split('|')[0]}`, pass: scenes.some((x) => re.test(x)), detail: scenes.join(' | ') || 'no scene observations' })
  }
  if (e.route === true) {
    const stay = mia.filter((l) => STAY.test(l.text)).length
    checks.push({ name: 'route guidance given', pass: r.routesServed > 0, detail: `${r.routesServed} route answer(s)${r.incident?.safeRoute ? ` → ${r.incident.safeRoute.destination.name}` : ''}` })
    checks.push({ name: 'never "stay where you are"', pass: stay === 0, detail: stay ? `${stay} line(s)` : 'kept caller moving' })
  }
  if (e.route === false) checks.push({ name: 'no directions when not moving', pass: r.routesServed === 0, detail: `${r.routesServed} route answer(s)` })
  if (e.track) {
    const n = r.incident?.location.track?.length ?? 0
    checks.push({ name: `GPS track ≥ ${e.track} points`, pass: n >= e.track, detail: `${n} point(s) on the dashboard` })
  }
  if (e.silent) checks.push({ name: 'observer stays silent', pass: r.metrics.spokenChunks === 0 && mia.length === 0, detail: `${r.metrics.spokenChunks} audio chunk(s) spoken` })
  if (r.incidentId) checks.push({ name: 'incident on dashboard', pass: !!r.incident, detail: r.incident ? `severity ${r.incident.severity}` : 'not found' })

  const firstDanger = reports.find((t) => affirmed((t.args.dangerIndicators as string[] | undefined) ?? []).length)
  const firstCaller = transcript.find((l) => l.who === 'caller')
  const firstAlertS = firstDanger ? secs(firstCaller ? Math.max(0, firstDanger.at - firstCaller.at) : firstDanger.at) : null
  r.metrics.firstDangerS = firstAlertS
  const mocks = [s.gps ? `GPS track (${s.gps.length} fixes)` : '', ...(s.media ?? []).map((m) => m.frames ? `camera: ${m.frames}` : `sound: ${m.audio}`), s.silent ? `camera: ${s.silent.frames} + sound: ${s.silent.audio}` : ''].filter(Boolean).join(', ') || 'none'
  const inc = r.incident
  return {
    id: s.id, title: s.title, features: s.features, group: s.group, language: s.language, mocks, run: 1, attempts: 1,
    expected: Object.entries(s.expect).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '),
    incidentId: r.incidentId, transcript, tools, turnTimings: r.turnTimings, checks,
    dashboard: {
      callState: inc?.callState ?? null, responseStatus: inc?.response.status ?? null,
      severity: inc?.severity ?? null, urgency: inc?.extractedFieldsLive.urgency ?? null,
      dangerIndicators: inc?.extractedFieldsLive.dangerIndicators ?? [], peopleCount: inc?.extractedFieldsLive.peopleCount ?? null,
      voiceStress: inc?.voiceStressScore ?? null, trackPoints: inc?.location.track?.length ?? 0,
      route: inc?.safeRoute ? `${inc.safeRoute.destination.name} (${inc.safeRoute.destination.kind})` : null,
      sceneObservations: (inc as { sceneObservations?: unknown[] } | undefined)?.sceneObservations?.length ?? 0,
    },
    metrics: r.metrics,
    firstAlertS, durationS: secs(r.durationMs)!, turns: r.turns, ...(r.error ? { error: r.error } : {}),
  }
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const todo = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS
const results: Result[] = []
const log = (r: Result) => {
  const ok = r.checks.filter((c) => c.pass).length
  const sem = r.checks.filter((c) => c.semantic).length
  console.log(`${r.error ? '✗' : ok === r.checks.length ? '✓' : '•'} ${`${r.id}#${r.run}`.padEnd(28)} strict ${ok}/${r.checks.length} · judged ${sem}/${r.checks.length} · ${r.turns} turns · ${r.durationS}s · ${r.incidentId ?? 'no incident'}${r.attempts > 1 ? ` · attempt ${r.attempts}` : ''}${r.error ? ` · ${r.error.slice(0, 80)}` : ''}`)
}
// An overloaded model or a network drop is not a test result: retry the whole call (new incident) up to twice.
async function runScenario(s: Scenario, run: number): Promise<Result> {
  let r!: Result
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await runCall(s)
    r.run = run
    r.attempts = attempt
    // Free tier out of Live quota: the rest of the run uses the paid key.
    if (r.error && QUOTA.test(r.error) && aiFree && tier(LIVE_MODEL) === 'free') {
      tierFor.set(LIVE_MODEL, 'paid')
      console.log(`  Live: free tier exhausted → paid key`)
      continue
    }
    if (!r.error || !transient(r.error)) break
    console.log(`  ${s.id}#${run} hit "${r.error.slice(0, 60)}…", retrying`)
    await sleep(15_000)
  }
  return r
}
// Results are saved after EVERY call, so a spend cap, a crash or Ctrl+C never loses the calls already made.
// Re-running a few scenarios merges them into the existing results.
const latest = new URL('./results/latest.json', import.meta.url)
const prevResults: Result[] = only.length && existsSync(latest) ? (JSON.parse(readFileSync(latest, 'utf8')) as { results: Result[] }).results : []
function save() {
  const merged = [...results, ...prevResults.filter((r) => !results.some((x) => x.id === r.id && x.run === (r.run ?? 1)))]
  merged.sort((a, b) => SCENARIOS.findIndex((s) => s.id === a.id) - SCENARIOS.findIndex((s) => s.id === b.id) || a.run - b.run)
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
  const out = { ranAt: new Date().toISOString(), liveModel: LIVE_MODEL, callerModel: CALLER_MODEL, judgeModel: JUDGE_MODELS.join(' → '), repeat: REPEAT, collection: RECORD ? INCIDENTS : null, maxTurns: MAX_TURNS, requests: keyUsage, results: merged }
  writeFileSync(latest, JSON.stringify(out, null, 2))
}
for (let run = 1; run <= REPEAT; run++) {
  // GPS scenarios share the one fake navigator.geolocation, so they run alone first.
  for (const s of todo.filter((x) => x.gps)) { const r = await runScenario(s, run); results.push(r); log(r); save() }
  gpsFix = null
  const rest = todo.filter((x) => !x.gps)
  let next = 0
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (next < rest.length) {
      const r = await runScenario(rest[next++], run)
      results.push(r)
      log(r)
      save()
    }
  }))
}

// Re-running a few scenarios (e.g. after a network drop) merges them into the existing results.
save()
const all = results.flatMap((r) => r.checks)
console.log(`\n${all.filter((c) => c.pass).length}/${all.length} checks passed across ${results.length} calls → eval/results/latest.json`)
if (db) await terminate(db)
process.exit(0)
