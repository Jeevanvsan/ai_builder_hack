import { GoogleGenAI, Modality, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import type { Firestore } from 'firebase/firestore'
import {
  appendTranscriptLine,
  recordCallerEstimate,
  recordVoiceStress,
  reportSceneObservation,
  updateLiveFields,
} from '../../../../shared/incidents/client'
import { SILENT_OBSERVER_INSTRUCTION } from '../../../../web/src/lib/gemini/persona'
import { REPORT_SCENE_OBSERVATION_TOOLS } from '../../../../web/src/lib/gemini/tools'
import { startMicCapture, type MicHandle } from '../platform/audio'
import { startCallRecording, type CallRecorder } from './recorder'
import type { FrameSource } from '../../../modules/qb-frames'
import { GEMINI_API_KEY } from '../config'

// Native port of web/src/lib/gemini/silentSession.ts — keep the two in sync.
//
// Streams the mic to Gemini but plays NOTHING back and never speaks: it only reports what it hears through tool
// calls. There is no end_call tool; the person ends the SOS with the exit gesture.
//
// Difference from the web, for now: no camera frames. The web also feeds both camera streams in, which on native
// needs a frame source that doesn't exist yet (Epic 12 phase 3). Audio-only still covers the sound-based
// observations, the stress trend and the caller estimate; camera observations simply won't appear until frames
// land. Everything else here is the web's logic unchanged.
const LIVE_MODEL = 'gemini-3.8-live'

export type SosRecording = { base64: string; mimeType: string }

export type SilentObserverHandle = {
  end: () => Promise<SosRecording | null>
  getTranscript: () => string
}

export async function startSilentObserver(
  db: Firestore,
  incidentId: string,
  opts: { frames?: FrameSource | null } = {},
): Promise<SilentObserverHandle> {
  if (!GEMINI_API_KEY) throw new Error('Gemini Live is not configured')

  const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  let finished = false
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3

  const transcriptLines: string[] = []

  // Tool calls arriving close together race on the same document — keep writes strictly sequential.
  let writeQueue: Promise<unknown> = Promise.resolve()
  const enqueueWrite = (write: () => Promise<unknown>) => {
    writeQueue = writeQueue.then(write, write)
  }

  const handleToolCall = (call: FunctionCall) => {
    const args = (call.args ?? {}) as Record<string, unknown>
    switch (call.name) {
      case 'report_situation': {
        const patch: Record<string, unknown> = {}
        if (typeof args.peopleCount === 'number') patch.peopleCount = args.peopleCount
        if (Array.isArray(args.dangerIndicators)) patch.dangerIndicators = args.dangerIndicators
        if (typeof args.urgency === 'string') patch.urgency = args.urgency
        if (typeof args.notes === 'string') patch.notes = args.notes
        enqueueWrite(() => updateLiveFields(db, incidentId, patch))
        break
      }
      case 'report_scene_observation': {
        const source = args.source
        const kind = args.kind
        if ((source === 'camera' || source === 'sound') && typeof kind === 'string') {
          enqueueWrite(() =>
            reportSceneObservation(db, incidentId, {
              source,
              kind,
              detail: typeof args.detail === 'string' ? args.detail : undefined,
              confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
            }),
          )
        }
        break
      }
      case 'report_stress_level': {
        const score = args.score
        if (typeof score === 'number') {
          enqueueWrite(() => recordVoiceStress(db, incidentId, Math.max(0, Math.min(100, score))))
        }
        break
      }
      case 'report_caller_estimate': {
        const ageGroup = args.ageGroup
        const gender = args.gender
        const AGE_GROUPS = ['child', 'teen', 'adult', 'elderly', 'unclear']
        const GENDERS = ['male', 'female', 'unclear']
        if (typeof ageGroup === 'string' && AGE_GROUPS.includes(ageGroup) && typeof gender === 'string' && GENDERS.includes(gender)) {
          enqueueWrite(() =>
            recordCallerEstimate(db, incidentId, {
              ageGroup: ageGroup as 'child' | 'teen' | 'adult' | 'elderly' | 'unclear',
              gender: gender as 'male' | 'female' | 'unclear',
              confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
            }),
          )
        }
        break
      }
    }
  }

  // Speech-to-text arrives in word-sized fragments. Group them into one line per utterance (flushed after a
  // short pause) so the dashboard's Conversation tab shows what the mic heard, live.
  let pending = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const flushHeard = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    const text = pending.trim()
    pending = ''
    if (text) enqueueWrite(() => appendTranscriptLine(db, incidentId, 'Caller', text))
  }

  const onMessage = (message: LiveServerMessage) => {
    const heard = message.serverContent?.inputTranscription?.text
    if (heard) {
      transcriptLines.push(heard)
      pending += heard
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = setTimeout(flushHeard, 1500)
    }

    const newHandle = message.sessionResumptionUpdate?.newHandle
    if (newHandle) resumptionHandle = newHandle

    const calls = message.toolCall?.functionCalls
    if (calls?.length) {
      for (const call of calls) handleToolCall(call)
      void session.sendToolResponse({
        functionResponses: calls.map((call) => ({ id: call.id, name: call.name, response: { output: 'ok' } })),
      })
    }
  }

  let session: Session
  // Tracks real socket health independently of `finished` (which only end() sets). Without it, a session that
  // dies before ever opening leaves every mic frame hitting a dead socket for the whole SOS.
  let connected = false

  const openSession = (resume?: string) =>
    client.live.connect({
      model: LIVE_MODEL,
      config: {
        // This model rejects TEXT-only responseModalities outright (close code 1007), which silently killed
        // every SOS session before it could hear anything. AUDIO is the only modality it supports for a Live
        // session. The observer still never speaks into the room: onMessage only reads the input transcription
        // and tool calls, and nothing plays the model's audio back.
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: SILENT_OBSERVER_INSTRUCTION,
        tools: REPORT_SCENE_OBSERVATION_TOOLS,
        // An SOS can run long, so compress the context and keep a resumption handle to reopen on a drop.
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: resume ? { handle: resume } : {},
      },
      callbacks: {
        // A quiet SOS can idle-timeout and reconnect many times over a long session — expected, not a failure,
        // so a successful reopen resets the counter.
        onopen: () => {
          connected = true
          reconnects = 0
        },
        onmessage: onMessage,
        onerror: (e) => console.error('[QuickBite SOS] observer error:', e),
        onclose: (e) => {
          connected = false
          console.warn('[QuickBite SOS] observer closed:', e?.code, e?.reason)
          // A quiet SOS — exactly the scenario this exists for — can idle out with a clean 1000 close before the
          // server ever sends a resumption handle, so reconnect regardless of whether one arrived. A fresh
          // connection without prior context beats a dead observer.
          if (!finished && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            void openSession(resumptionHandle)
              .then((s) => {
                session = s
              })
              .catch((err) => console.error('[QuickBite SOS] reconnect failed:', err))
            return
          }
          if (!finished) {
            console.warn('[QuickBite SOS] observer could not reconnect — sends suppressed until the SOS ends.')
          }
        },
      },
    })

  session = await openSession()

  const canSend = () => connected && !finished

  // The SOS keeps its own recording of the room, uploaded on exit like the call's.
  const recorder: CallRecorder = startCallRecording()

  const mic: MicHandle = await startMicCapture((base64Pcm, _level, pcm) => {
    recorder.addMic(pcm)
    if (canSend()) session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
  })

  // Camera stills, same cadence as the call. This is what turns "heard a scream" into "saw two people and a
  // weapon on the table" in the responder's evidence list.
  const frameTimer = opts.frames
    ? setInterval(() => {
        if (finished) return
        const jpeg = opts.frames?.grab()
        if (jpeg && canSend()) session.sendRealtimeInput({ video: { data: jpeg, mimeType: 'image/jpeg' } })
      }, 1_000)
    : null

  if (canSend()) {
    session.sendClientContent({ turns: 'A silent SOS has started. Begin observing and reporting through tools now.' })
  }

  let ended = false
  return {
    end: async () => {
      // end() can be called twice in quick succession (a fast repeat of the exit gesture, or a second trigger
      // racing the first). Closing an already-closing socket floods the log, so teardown runs once.
      if (ended) return null
      ended = true
      finished = true
      flushHeard()
      if (frameTimer) clearInterval(frameTimer)
      opts.frames?.stop()
      mic.stop()
      const recording = recorder.stop()
      session.close()
      return recording
    },

    getTranscript: () => transcriptLines.join(' ').trim(),
  }
}
