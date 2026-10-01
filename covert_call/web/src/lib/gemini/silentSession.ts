import { Modality, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import { geminiConfigured, liveConnect } from './aiLogic.ts'
import type { Firestore } from 'firebase/firestore'
import { appendTranscriptLine, recordCallerEstimate, recordVoiceStress, reportSceneObservation, updateLiveFields } from '../../../../shared/incidents/client.ts'
import { startMicCapture } from './audio.ts'
import { startFrameSampler, type FrameSampler } from './frames.ts'
import { SILENT_OBSERVER_INSTRUCTION } from './persona.ts'
import { REPORT_SCENE_OBSERVATION_TOOLS } from './tools.ts'

const LIVE_MODEL = 'gemini-3.8-live'

export type SilentObserverHandle = {
  end: () => Promise<void>
  getTranscript: () => string
}

// Opens a silent Gemini Live observer for the SOS (Epic 11.3): streams the mic and camera frames in, but plays
// NOTHING back and never speaks — it only reports what it sees and hears through tool calls. No end_call tool; the
// person ends the SOS with the secret exit gesture. Reuses the mic/frame plumbing but not the audio player.
export async function startSilentObserver(
  db: Firestore,
  incidentId: string,
  opts: { micStream: MediaStream; videoStreams: MediaStream[] },
): Promise<SilentObserverHandle> {
  if (!geminiConfigured) throw new Error('Gemini Live is not configured')
  let finished = false
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3

  const transcriptLines: string[] = []

  // Tool calls arriving close together race on the same Firestore document — keep every write to this incident
  // strictly sequential (same reasoning as the live call).
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
        if (typeof score === 'number') enqueueWrite(() => recordVoiceStress(db, incidentId, Math.max(0, Math.min(100, score))))
        break
      }
      case 'report_caller_estimate': {
        const ageGroup = args.ageGroup
        const gender = args.gender
        const AGE_GROUPS = ['child', 'teen', 'adult', 'elderly', 'unclear']
        const GENDERS = ['male', 'female', 'unclear']
        if (typeof ageGroup === 'string' && AGE_GROUPS.includes(ageGroup) && typeof gender === 'string' && GENDERS.includes(gender)) {
          enqueueWrite(() => recordCallerEstimate(db, incidentId, {
            ageGroup: ageGroup as 'child' | 'teen' | 'adult' | 'elderly' | 'unclear',
            gender: gender as 'male' | 'female' | 'unclear',
            confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
          }))
        }
        break
      }
    }
  }

  // Speech-to-text arrives in word-sized fragments. Group them into one line per utterance (flushed after a short
  // pause) and write each to the incident, so the dashboard's Conversation tab shows what the mic heard live.
  let pending = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const flushHeard = () => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
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
  // The previous check before every send was only `!finished` — true until the person actively ends the SOS.
  // If the very first connection attempt fails or closes before a resumption handle ever arrives (drops in the
  // first second, never truly opens), `resumptionHandle` stays undefined, the reconnect condition below is
  // false, NOTHING reconnects, and the session sits dead — but `finished` never becomes true either, since only
  // end() sets it. Every mic/frame callback kept calling sendRealtimeInput on that dead socket for as long as the
  // SOS ran, which is the actual, confirmed source of the "WebSocket is already in CLOSING or CLOSED state" flood
  // (previously misdiagnosed as a stray-frame timing issue — that was real too, but not this). `connected` tracks
  // real socket health independent of `finished`/the resumption handle, and every send now checks both.
  let connected = false

  const openSession = (resume?: string) =>
    liveConnect({
      model: LIVE_MODEL,
      config: {
        // gemini-3.8-live rejects TEXT-only responseModalities outright ("requested combination of response
        // modalities (TEXT) is not supported by the model") — confirmed via a real onclose event (code 1007) on
        // a real device test: every SOS session was rejected before it could ever hear or see anything, which is
        // why nothing was ever detected in any test. AUDIO is the only modality this model actually supports for
        // a Live session. The observer still never speaks into the room: onMessage below only ever reads
        // inputTranscription (what the mic heard) and tool calls — it never touches
        // message.serverContent.modelTurn's audio parts or plays them back, so the spoken response Gemini
        // generates is simply received and ignored, not silenced after the fact.
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        // Added alongside the AUDIO fix: liveSession.ts's working config always pairs AUDIO responseModalities
        // with outputAudioTranscription, and never leaves the model's spoken response completely unacknowledged
        // by the client. This closes that gap for parity with the one config on this project that's been proven
        // to hold a stable Live session — the observer still never reads the text this produces, since nothing
        // plays it or forwards it anywhere.
        outputAudioTranscription: {},
        systemInstruction: SILENT_OBSERVER_INSTRUCTION,
        tools: REPORT_SCENE_OBSERVATION_TOOLS,
        // An SOS can run long and carries video, so compress the context and keep a resumption handle to reopen on
        // a drop.
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: resume ? { handle: resume } : {},
      },
      callbacks: {
        // A quiet SOS can idle-timeout and reconnect many times over a long session — that's expected, not a
        // failure, so a successful reopen resets the counter. Otherwise a 20-minute silent SOS that idles out
        // every few minutes would permanently die after its 4th otherwise-successful reconnect.
        onopen: () => { connected = true; reconnects = 0 },
        onmessage: onMessage,
        onerror: (e) => console.error('[QuickBite SOS] observer error:', e),
        onclose: (e) => {
          connected = false
          console.warn('[QuickBite SOS] observer closed:', e?.code, e?.reason)
          // A quiet SOS (the exact scenario this feature exists for — someone hiding, not talking) can idle out on
          // Gemini's Live API with a clean 1000 close before the server ever sends a sessionResumptionUpdate, so
          // resumptionHandle can still be undefined here. Previously the reconnect only fired when a handle
          // existed, so a silent SOS that idled out just died with no retry — confirmed on a real device test
          // (mostly-quiet SOS, closed itself in the background, no reconnect logged). A fresh connection (even
          // without resuming prior context) is far better than a dead observer, so reconnect regardless of whether
          // a handle is available.
          if (!finished && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            void openSession(resumptionHandle).then((s) => { session = s }).catch((err) => {
              console.error('[QuickBite SOS] reconnect failed:', err)
            })
            return
          }
          if (!finished) {
            console.warn('[QuickBite SOS] observer could not reconnect — attempts exhausted; mic/frame sends now suppressed until the SOS ends.')
          }
        },
      },
    })

  session = await openSession()

  const canSend = () => connected && !finished

  const mic = await startMicCapture((base64Pcm) => {
    if (canSend()) session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
  }, opts.micStream)

  // One frame sampler per camera (front + back). Both feed the same observer.
  const samplers: FrameSampler[] = opts.videoStreams.map((stream) =>
    startFrameSampler(stream, (base64Jpeg) => {
      if (canSend()) session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })
    }),
  )

  // Nudge it to start observing immediately.
  if (canSend()) session.sendClientContent({ turns: 'A silent SOS has started. Begin observing and reporting through tools now.' })

  let ended = false
  return {
    end: async () => {
      // end() can be called twice in quick succession (e.g. a fast double-tap on the exit gesture, or a second
      // trigger racing the first) — session.close() on an already-closing socket spams "WebSocket is already in
      // CLOSING or CLOSED state" into the console for every subsequent chunk still in flight. Guard so the real
      // teardown only ever runs once.
      if (ended) return
      ended = true
      finished = true
      flushHeard()
      samplers.forEach((s) => s.stop())
      mic.stop()
      session.close()
    },
    getTranscript: () => transcriptLines.join(' ').trim(),
  }
}
