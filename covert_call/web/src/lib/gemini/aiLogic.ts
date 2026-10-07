import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai'
import { getAI, getGenerativeModel, getLiveGenerativeModel, GoogleAIBackend, ResponseModality, type AI, type LiveSession } from 'firebase/ai'
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { setLogLevel } from 'firebase/app'
import { app } from '../firebase'
import type { Firestore } from 'firebase/firestore'
import { usageFromMetadata } from '../../../../shared/aiModels.ts'
import { recordAiUsage } from '../../../../shared/incidents/client.ts'
import { createKeyPool, isQuotaError, withKeyFallback, type KeyTier } from '../../../../shared/gemini/keyPool.ts'

// Firebase AI Logic (Epic 27): every Gemini call goes through Firebase's proxy instead of a Gemini API key shipped
// in the browser bundle, and App Check (Fraud Defense / reCAPTCHA Enterprise) makes sure only this app can call it.
// Opt-in per build with VITE_USE_AI_LOGIC=true (the staging site first); otherwise the old key-based path is used.

export const USE_AI_LOGIC = import.meta.env.VITE_USE_AI_LOGIC === 'true'
// Key path: the free-tier key first, the paid (credits) key once free is out of quota (shared/gemini/keyPool.ts).
// Staging builds (`vite build --mode staging`) use the free-tier key ONLY, never the paid one.
const FREE_KEY = import.meta.env.VITE_GEMINI_LIVE_API_KEY_FREE as string | undefined
const keys = createKeyPool(
  import.meta.env.MODE === 'staging'
    ? { free: FREE_KEY }
    : { free: FREE_KEY, paid: import.meta.env.VITE_GEMINI_LIVE_API_KEY as string | undefined },
  'web',
)

// True when either path can reach Gemini (replaces the old "is the API key set" checks).
export const geminiConfigured = USE_AI_LOGIC || keys.configured

let ai: AI | null = null
let appCheck: AppCheck | null = null
function aiLogic(): AI {
  if (ai) return ai
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined
  if (siteKey) appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })
  ai = getAI(app, { backend: new GoogleAIBackend() })
  return ai
}

// Start App Check the moment the page loads: the first token takes a few seconds, and a call opened before it
// arrives is refused ("App Check token is invalid").
if (USE_AI_LOGIC) {
  aiLogic()
  // The Live API sends some messages the SDK doesn't recognise (empty frames) and it warns on every one, flooding
  // the console. They're harmless; keep Firebase to real errors only.
  setLogLevel('error')
}

// The SDK hides the Live WebSocket and always ends receive() the same way, so a server close (time limit, bad
// config, quota) reached us as a plain "stream ended". Keep a handle on the Live socket to report its real close
// code and reason.
let lastLiveSocket: WebSocket | null = null
if (USE_AI_LOGIC && typeof window !== 'undefined' && !(window.WebSocket as unknown as { __qbTracked?: boolean }).__qbTracked) {
  const Native = window.WebSocket
  class Tracked extends Native {
    static __qbTracked = true
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      if (String(url).includes('BidiGenerateContent')) lastLiveSocket = this
    }
  }
  window.WebSocket = Tracked as unknown as typeof WebSocket
}

// Every AI Logic request waits for a valid App Check token first (resolves at once once one is cached).
async function appCheckReady(): Promise<void> {
  aiLogic()
  if (appCheck) await getToken(appCheck, false).catch(() => {})
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } }
type TextRequest = {
  model: string
  task?: string // which job this is (shared/aiModels.ts), for the per-incident AI usage breakdown
  contents: string | { role: string; parts: Part[] }[]
  config?: { responseMimeType?: string; responseSchema?: unknown; tools?: unknown[] }
}

// ---------- AI usage per incident (staging /ai-usage page) ----------
// The incident the current call/SOS/tap belongs to; text requests made meanwhile are counted against it.
let usageTarget: { db: Firestore; id: string } | null = null
export const setUsageIncident = (db: Firestore, id: string) => { usageTarget = { db, id } }
export const currentLiveTier = (): KeyTier => lastLiveTier ?? 'free'
function noteTextUsage(req: TextRequest, meta: Parameters<typeof usageFromMetadata>[0], tier: KeyTier, ms: number) {
  if (!usageTarget || !req.task) return
  void recordAiUsage(usageTarget.db, usageTarget.id, req.task, { model: req.model, tier, requests: 1, ms, ...usageFromMetadata(meta) })
}

// The one call shape the text helpers use (consolidate, correlate, photo, grounded context), with the same
// `{ text }` result on either path, so those files only swap how they get a client.
export async function generateText(req: TextRequest): Promise<{ text: string | undefined }> {
  if (!USE_AI_LOGIC) {
    if (!keys.configured) throw new Error('Gemini is not configured')
    const t0 = Date.now()
    let usedTier: KeyTier = 'free'
    const { task: _task, ...apiReq } = req
    const r = await withKeyFallback(keys, (apiKey, tier) => { usedTier = tier; return new GoogleGenAI({ apiKey }).models.generateContent(apiReq as Parameters<GoogleGenAI['models']['generateContent']>[0]) }, req.model)
    noteTextUsage(req, r.usageMetadata, usedTier, Date.now() - t0)
    return { text: r.text }
  }
  await appCheckReady()
  const model = getGenerativeModel(aiLogic(), {
    model: req.model,
    generationConfig: {
      ...(req.config?.responseMimeType ? { responseMimeType: req.config.responseMimeType } : {}),
      // Same OpenAPI-style schema object the Gemini API takes; the proxy passes it through unchanged.
      ...(req.config?.responseSchema ? { responseSchema: req.config.responseSchema as never } : {}),
    },
    ...(req.config?.tools ? { tools: req.config.tools as never } : {}),
  })
  const t0 = Date.now()
  const r = await model.generateContent(typeof req.contents === 'string' ? req.contents : { contents: req.contents as never })
  noteTextUsage(req, r.response.usageMetadata as never, 'paid', Date.now() - t0)
  return { text: r.response.text() }
}

// ---------- Live call ----------

export type LiveCallbacks = {
  onopen: () => void
  onmessage: (m: LiveServerMessage) => void
  onerror: (e: unknown) => void
  onclose: (e?: { code?: number; reason?: string }) => void
}

// The subset of @google/genai's live Session that liveSession.ts uses, implemented over Firebase AI Logic.
export type LiveTransport = {
  sendRealtimeInput: (input: { audio?: { data: string; mimeType: string }; video?: { data: string; mimeType: string } }) => void
  sendClientContent: (content: { turns: string; turnComplete?: boolean }) => void
  sendToolResponse: (r: { functionResponses: { id?: string; name?: string; response: object; scheduling?: unknown }[] }) => void
  close: () => void
}

type LiveConfig = {
  speechConfig?: unknown
  systemInstruction?: unknown
  tools?: unknown
  contextWindowCompression?: unknown
  sessionResumption?: { handle?: string }
}

// What Firebase's Live API doesn't expose yet (compared with the key-based path): transcription language hints and
// custom vocabulary, and the voice-activity tuning (realtimeInputConfig). Everything else maps one to one.
export async function connectLiveViaAiLogic(modelName: string, config: LiveConfig, cb: LiveCallbacks): Promise<LiveTransport> {
  await appCheckReady()
  const model = getLiveGenerativeModel(aiLogic(), {
    model: modelName,
    generationConfig: {
      responseModalities: [ResponseModality.AUDIO],
      speechConfig: config.speechConfig as never,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      ...(config.contextWindowCompression ? { contextWindowCompression: config.contextWindowCompression as never } : {}),
    },
    systemInstruction: config.systemInstruction as never,
    tools: config.tools as never,
  })

  let session: LiveSession
  try {
    // Always pass the resumption config (empty on a first connect) so the server sends resumption handles; without
    // it a dropped call or SOS can only reconnect fresh, losing the conversation so far.
    session = await model.connect(config.sessionResumption ? { ...config.sessionResumption } : undefined)
  } catch (e) {
    cb.onerror(e)
    throw e
  }
  cb.onopen()
  const socket = lastLiveSocket
  let closeInfo: { code?: number; reason?: string } | null = null
  socket?.addEventListener('close', (e) => { closeInfo = { code: e.code, reason: e.reason } }, { once: true })

  // Translate Firebase's messages into the @google/genai shape liveSession.ts already handles.
  void (async () => {
    try {
      for await (const m of session.receive()) {
        if (m.type === 'serverContent') {
          cb.onmessage({
            serverContent: {
              modelTurn: m.modelTurn as never,
              turnComplete: m.turnComplete,
              interrupted: m.interrupted,
              inputTranscription: m.inputTranscription,
              outputTranscription: m.outputTranscription,
            },
          } as unknown as LiveServerMessage)
        } else if (m.type === 'toolCall') {
          cb.onmessage({ toolCall: { functionCalls: m.functionCalls } } as unknown as LiveServerMessage)
        } else if ((m as { type: string }).type === 'sessionResumptionUpdate') {
          cb.onmessage({ sessionResumptionUpdate: { newHandle: (m as { newHandle?: string }).newHandle } } as unknown as LiveServerMessage)
        }
      }
      // Give the socket's close event a moment to land so the real code and reason are reported.
      await new Promise((r) => setTimeout(r, 50))
      cb.onclose(closeInfo ?? { code: 1000, reason: 'stream ended' })
    } catch (e) {
      cb.onerror(e)
      cb.onclose({ code: 1011, reason: String(e) })
    }
  })()

  return {
    sendRealtimeInput: (input) => {
      if (session.isClosed) return
      if (input.audio) void session.sendAudioRealtime(input.audio).catch(() => {})
      if (input.video) void session.sendVideoRealtime(input.video).catch(() => {})
    },
    sendClientContent: ({ turns, turnComplete }) => {
      if (!session.isClosed) void session.send(turns, turnComplete ?? true).catch(() => {})
    },
    sendToolResponse: ({ functionResponses }) => {
      if (!session.isClosed) // scheduling passed through: SILENT tool responses must not start a reply on this path either.
        void session.sendFunctionResponses(functionResponses.map((f) => ({ id: f.id, name: f.name ?? '', response: f.response, ...(f.scheduling ? { scheduling: f.scheduling } : {}) }) as never)).catch(() => {})
    },
    close: () => void session.close().catch(() => {}),
  }
}

// One way to open a Live session for both the call and the silent SOS: through Firebase AI Logic when it is on,
// otherwise the original key-based connection.
// Key path: free key first. Free-tier Live quota shows up either as a refused connect or as a close right after
// opening; both mark free as used up, and the close is passed on so the session's own reconnect reopens it, now on
// the paid key. A resumption handle belongs to the project that issued it, so it's dropped when the key changes.
let lastLiveTier: KeyTier | null = null
export async function liveConnect(p: { model: string; config: Record<string, unknown>; callbacks: LiveCallbacks }): Promise<Session> {
  if (USE_AI_LOGIC) return connectLiveViaAiLogic(p.model, p.config, p.callbacks) as unknown as Promise<Session>
  const open = (key: string, tier: KeyTier) => {
    const resumption = p.config.sessionResumption as { handle?: string } | undefined
    const config = resumption?.handle && lastLiveTier && lastLiveTier !== tier ? { ...p.config, sessionResumption: {} } : p.config
    lastLiveTier = tier
    return new GoogleGenAI({ apiKey: key }).live.connect({
      ...p,
      config,
      callbacks: {
        ...p.callbacks,
        onclose: (e?: { code?: number; reason?: string }) => {
          if (isQuotaError(e?.reason ?? '')) keys.failed(tier, e?.reason ?? 'quota', p.model)
          p.callbacks.onclose(e)
        },
      },
    } as never)
  }
  return withKeyFallback(keys, open, p.model)
}
