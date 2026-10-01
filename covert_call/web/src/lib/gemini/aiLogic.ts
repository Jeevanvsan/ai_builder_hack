import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai'
import { getAI, getGenerativeModel, getLiveGenerativeModel, GoogleAIBackend, ResponseModality, type AI, type LiveSession } from 'firebase/ai'
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { app } from '../firebase'

// Firebase AI Logic (Epic 27): every Gemini call goes through Firebase's proxy instead of a Gemini API key shipped
// in the browser bundle, and App Check (Fraud Defense / reCAPTCHA Enterprise) makes sure only this app can call it.
// Opt-in per build with VITE_USE_AI_LOGIC=true (the staging site first); otherwise the old key-based path is used.

export const USE_AI_LOGIC = import.meta.env.VITE_USE_AI_LOGIC === 'true'
const LEGACY_KEY = import.meta.env.VITE_GEMINI_LIVE_API_KEY as string | undefined

// True when either path can reach Gemini (replaces the old "is the API key set" checks).
export const geminiConfigured = USE_AI_LOGIC || Boolean(LEGACY_KEY)

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
if (USE_AI_LOGIC) aiLogic()

// Every AI Logic request waits for a valid App Check token first (resolves at once once one is cached).
async function appCheckReady(): Promise<void> {
  aiLogic()
  if (appCheck) await getToken(appCheck, false).catch(() => {})
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } }
type TextRequest = {
  model: string
  contents: string | { role: string; parts: Part[] }[]
  config?: { responseMimeType?: string; responseSchema?: unknown; tools?: unknown[] }
}

// The one call shape the text helpers use (consolidate, correlate, photo, grounded context), with the same
// `{ text }` result on either path, so those files only swap how they get a client.
export async function generateText(req: TextRequest): Promise<{ text: string | undefined }> {
  if (!USE_AI_LOGIC) {
    if (!LEGACY_KEY) throw new Error('Gemini is not configured')
    const r = await new GoogleGenAI({ apiKey: LEGACY_KEY }).models.generateContent(req as Parameters<GoogleGenAI['models']['generateContent']>[0])
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
  const r = await model.generateContent(typeof req.contents === 'string' ? req.contents : { contents: req.contents as never })
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
  sendToolResponse: (r: { functionResponses: { id?: string; name?: string; response: object }[] }) => void
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
    session = await model.connect(config.sessionResumption?.handle ? { handle: config.sessionResumption.handle } : undefined)
  } catch (e) {
    cb.onerror(e)
    throw e
  }
  cb.onopen()

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
      cb.onclose({ code: 1000, reason: 'stream ended' })
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
      if (!session.isClosed) void session.sendFunctionResponses(functionResponses.map((f) => ({ id: f.id, name: f.name ?? '', response: f.response }))).catch(() => {})
    },
    close: () => void session.close().catch(() => {}),
  }
}

// One way to open a Live session for both the call and the silent SOS: through Firebase AI Logic when it is on,
// otherwise the original key-based connection.
export function liveConnect(p: { model: string; config: Record<string, unknown>; callbacks: LiveCallbacks }): Promise<Session> {
  if (USE_AI_LOGIC) return connectLiveViaAiLogic(p.model, p.config, p.callbacks) as unknown as Promise<Session>
  return new GoogleGenAI({ apiKey: LEGACY_KEY }).live.connect(p as never)
}
