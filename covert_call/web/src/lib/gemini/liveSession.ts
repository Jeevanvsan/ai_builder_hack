import { GoogleGenAI, Modality, StartSensitivity, ThinkingLevel, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import type { Firestore } from 'firebase/firestore'
import { appendTranscriptLine, confirmAddress, recordAdvice, recordVoiceStress, reportSceneObservation, updateLiveFields } from '../../../../shared/incidents/client.ts'
import { createAudioPlayer, startMicCapture } from './audio.ts'
import { startFrameSampler, type FrameSampler } from './frames.ts'
import { PERSONA_SYSTEM_INSTRUCTION } from './persona.ts'
import { startCallRecording, type CallRecorder } from './recorder.ts'
import { LIVE_CALL_TOOLS } from './tools.ts'
import { startLiveTracking, type LiveTracker } from '../nav/liveTracking.ts'

// The @google/genai SDK's own doc comment names gemini-live-2.5-flash-preview, but that model returned
// "not found for API version v1beta" (error 1008) against a real key — gemini-3.8-live is the current default
// Live API model for low-latency voice agents. Kept as a single constant, not hardcoded elsewhere, so it's easy
// to swap again if the model catalog changes.
// Plain Live is the default: in testing, Extended Thinking dropped the caller's transcript and misheard English,
// with no real latency gain. `?model=extended` opts into Extended Thinking for side-by-side testing.
const USE_PLAIN_LIVE = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('model') === 'extended')
const LIVE_MODEL = USE_PLAIN_LIVE ? 'gemini-3.8-live' : 'gemini-3.8-live-extended-thinking'

export type CallStatus = 'connecting' | 'live' | 'ended' | 'failed'

export type LiveCallHandle = {
  end: () => Promise<Blob | null>
  toggleMute: () => boolean
  getTranscript: () => string
}

type LiveCallCallbacks = {
  onStatusChange: (status: CallStatus) => void
  // Fired when the model calls end_call (Story: auto-end once the caller confirms, or after 3 silent retries) —
  // the page reacts to this the same way it reacts to the user pressing the End button.
  onCallEnd: () => void
}

// Opens a Gemini Live session for the disguised call, streams the mic to it, plays the response back, and wires
// every tool call the model makes straight into the shared incident client (Epic 3.2/3.3) as it happens.
export async function startLiveCall(
  db: Firestore,
  incidentId: string,
  callbacks: LiveCallCallbacks,
  // The caller can pass a mic stream it already opened (Epic 9 opens the mic and the back camera together); when
  // omitted, the mic is opened here as before. `videoStream` (Epic 10) turns on ~1 fps camera frames to Gemini.
  opts: { micStream?: MediaStream; videoStream?: MediaStream } = {},
): Promise<LiveCallHandle> {
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey) throw new Error('Gemini Live is not configured')

  const client = new GoogleGenAI({ apiKey })
  // Live GPS + route to safety; started once the session is open (turn notes are sent into it).
  let tracker: LiveTracker | null = null
  const player = createAudioPlayer()
  let muted = false
  let micStop: (() => void) | null = null
  const transcriptLines: { speaker: string; text: string }[] = []
  // Epic 17.1: flush a completed line to Firestore on a speaker switch (the previous speaker's line is now
  // "done"), plus a periodic safety flush so a long stretch from one speaker doesn't wait forever to appear live.
  // Fragments arrive word-sized from the transcription API; writing every fragment would be far too write-heavy,
  // so only completed lines are persisted, reusing the same write queue as every other live write.
  let lastFlushedIndex = -1
  let lastFlushedLength = 0
  // includeLast: the periodic safety timer also flushes a still-growing last line (good enough for a live view,
  // re-appended as a fresh Firestore entry each time it grows) — a real speaker switch, by contrast, only ever
  // flushes completed lines, since the switch itself is the signal that the previous line is truly done.
  const flushTranscript = (includeLast = false) => {
    const upTo = includeLast ? transcriptLines.length : transcriptLines.length - 1
    for (let i = lastFlushedIndex + 1; i < upTo; i++) {
      const line = transcriptLines[i]
      const speaker = line.speaker === 'Mia' ? 'Mia' : 'Caller'
      const text = line.text.trim()
      if (text) enqueueWrite(() => appendTranscriptLine(db, incidentId, speaker, text))
      lastFlushedIndex = i
    }
    // The still-open last line, if it grew since the last periodic flush, gets appended again (superseding the
    // partial version already written) — acceptable duplication for a live view, trimmed at consolidation time.
    if (includeLast && transcriptLines.length > 0) {
      const last = transcriptLines[transcriptLines.length - 1]
      if (last.text.length > lastFlushedLength) {
        const speaker = last.speaker === 'Mia' ? 'Mia' : 'Caller'
        const text = last.text.trim()
        if (text) enqueueWrite(() => appendTranscriptLine(db, incidentId, speaker, text))
        lastFlushedLength = last.text.length
      }
    }
  }
  const appendTranscript = (speaker: string, text: string) => {
    const last = transcriptLines.at(-1)
    if (last?.speaker === speaker) last.text += text
    else {
      flushTranscript()
      lastFlushedLength = 0
      transcriptLines.push({ speaker, text })
    }
  }

  // Gemini Live only takes a turn after it hears the caller, so silence never makes it speak on its own.
  // This watchdog nudges it to re-ask after a quiet gap, and hangs up itself if the model doesn't after 3 tries.
  const SILENCE_MS = 12_000
  const SPEAKING_LEVEL = 0.02
  let lastActivityAt = Date.now()
  let silentNudges = 0
  let finished = false
  // Session resumption (Epic 10.1): a session with video attached hits a shorter cap, so we keep the latest
  // resumption handle and transparently reopen the session if it drops mid-call. Only used when video is on.
  const useVideo = Boolean(opts.videoStream)
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3

  // Gemini can fire several tool calls back-to-back within the same turn (e.g. report_situation right after
  // report_stress_level) — writing to the same Firestore document concurrently from two overlapping
  // runTransaction() calls races and one loses with `failed-precondition`. Queuing keeps every write to this
  // incident strictly sequential without slowing the conversation itself (writes are fire-and-forget either way).
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
      case 'confirm_address': {
        const address = args.address
        if (typeof address === 'string') enqueueWrite(() => confirmAddress(db, incidentId, address))
        break
      }
      case 'report_stress_level': {
        const score = args.score
        if (typeof score === 'number') enqueueWrite(() => recordVoiceStress(db, incidentId, Math.max(0, Math.min(100, score))))
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
      case 'report_advice': {
        if (typeof args.text === 'string' && args.text.trim()) enqueueWrite(() => recordAdvice(db, incidentId, args.text as string))
        break
      }
      case 'end_call': {
        // The tool call can arrive before its own closing-line audio has finished playing (or, if the model is
        // over-eager, before the greeting itself has played on a very short first turn) — a grace period lets
        // whatever's already queued in the player finish instead of cutting the caller off mid-sentence.
        finished = true
        setTimeout(() => callbacks.onCallEnd(), 4000)
        break
      }
    }
  }

  const onMessage = (message: LiveServerMessage) => {
    if (import.meta.env.DEV) console.debug('[QuickBite call] message:', message)

    // Speech-to-text for both sides arrives in word-sized fragments (AUDIO-only responses never set message.text).
    const callerText = message.serverContent?.inputTranscription?.text
    if (callerText) {
      appendTranscript('Caller', callerText)
      lastActivityAt = Date.now()
      silentNudges = 0
    }
    const miaText = message.serverContent?.outputTranscription?.text
    if (miaText) appendTranscript('Mia', miaText)

    const audioPart = message.serverContent?.modelTurn?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('audio/'))
    if (audioPart?.inlineData?.data) {
      player.play(audioPart.inlineData.data)
      lastActivityAt = Date.now()
    }

    // Interruption is normal mid-conversation barge-in, not the end of the call — only clear what's queued so
    // playback stays responsive; player.stop() would permanently close the audio context after the very first
    // interruption, explaining the earlier bug where the persona went silent partway through every real call.
    if (message.serverContent?.interrupted) player.clearQueue()

    // Keep the newest resumption handle so we can reopen the session if it drops mid-call (video sessions are short).
    const newHandle = message.sessionResumptionUpdate?.newHandle
    if (newHandle) resumptionHandle = newHandle

    const calls = message.toolCall?.functionCalls
    if (calls?.length) {
      const routeCalls = calls.filter((c) => c.name === 'get_route_guidance')
      const others = calls.filter((c) => c.name !== 'get_route_guidance')
      for (const call of others) handleToolCall(call)
      if (others.length) {
        void session.sendToolResponse({
          functionResponses: others.map((call) => ({ id: call.id, name: call.name, response: { output: 'ok' } })),
        })
      }
      // Route guidance needs a real answer (live GPS + routing), so it's answered once the tracker resolves.
      for (const call of routeCalls) {
        const args = (call.args ?? {}) as { situation?: string; landmark?: string }
        void (tracker ? tracker.guidance(args.situation, args.landmark) : Promise.resolve('No GPS yet — ask for the nearest landmark.'))
          .catch(() => 'Routing is unavailable right now — ask for the nearest landmark and keep them moving somewhere busy and lit.')
          .then((output) => session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { output } }] }))
      }
    }
  }

  let session: Session
  callbacks.onStatusChange('connecting')

  const openSession = (resume?: string) =>
    client.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        // "Kore" reads as a female voice, matching the persona's name ("Mia") — without this the default voice
        // didn't match the name and sounded jarring against the female name in the system instruction.
        // Deliberately no speechConfig.languageCode here — locking one would prevent the model from switching
        // languages mid-call when the caller does, per persona.ts's LANGUAGE instruction. Leave it to the
        // model's own multilingual detection instead.
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        // AUDIO-only responseModalities never populates message.text on its own — these two turn on Gemini's
        // own speech-to-text for both directions, which is what actually fills message.serverContent's
        // transcription fields below. Without this the whole call transcript was silently empty every time,
        // even on calls where the audio itself worked fine, breaking consolidation/leakage-check downstream.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Scared callers pause mid-answer. Low end-sensitivity + a longer silence window stop Gemini from taking its
        // turn in those pauses; low start-sensitivity keeps Mia's own voice leaking from the speaker (noise
        // suppression is off) from counting as the caller barging in and making her restart her sentence.
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            prefixPaddingMs: 200,
            // ~0.7 s: long enough for a breath mid-answer, short enough that replies don't feel slow. (1.2 s with
            // low end-sensitivity added over a second of dead air to every turn.)
            silenceDurationMs: 700,
          },
        },
        // Low keeps replies quick on a live call; the model still thinks in the background while speaking.
        ...(USE_PLAIN_LIVE ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
        systemInstruction: PERSONA_SYSTEM_INSTRUCTION,
        tools: LIVE_CALL_TOOLS,
        // Only for video calls (Epic 10): compression stretches the shorter audio+video session, and resumption
        // lets us reopen it if it drops. Audio-only calls keep the exact proven config, so their behaviour is
        // unchanged. `resume` carries the handle from a previous session when reconnecting.
        ...(useVideo ? { contextWindowCompression: { slidingWindow: {} }, sessionResumption: resume ? { handle: resume } : {} } : {}),
      },
      callbacks: {
        // onopen can fire before `client.live.connect()`'s own promise resolves and assigns `session` below —
        // sending the greeting nudge from here throws (session is still undefined). Just flip status here;
        // the greeting itself is sent right after the `await` completes instead, once `session` definitely exists.
        onopen: () => callbacks.onStatusChange('live'),
        onmessage: onMessage,
        onerror: (e) => {
          console.error('[QuickBite call] Gemini Live error:', e)
          callbacks.onStatusChange('failed')
        },
        onclose: (e) => {
          console.warn('[QuickBite call] Gemini Live closed:', e?.code, e?.reason)
          // A video session that drops before the call is done and still has a resumption handle is reopened
          // transparently, so the caller never sees the call end mid-conversation.
          if (!finished && useVideo && resumptionHandle && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            callbacks.onStatusChange('connecting')
            void openSession(resumptionHandle)
              .then((s) => { session = s })
              .catch(() => callbacks.onStatusChange('ended'))
            return
          }
          if (!finished) callbacks.onStatusChange('ended')
        },
      },
    })

  try {
    session = await openSession()
  } catch {
    callbacks.onStatusChange('failed')
    throw new Error("Couldn't connect the call")
  }

  // The model waits for input by default — nudge it to speak first, matching a real call where the person
  // answering greets the caller, not the other way round.
  session.sendClientContent({ turns: 'The call has just connected. Greet the caller now, as instructed.' })

  tracker = startLiveTracking(db, incidentId, (note) => {
    if (finished) return
    session.sendClientContent({
      turns: `(System note, not the caller — live navigation: ${note} If you are guiding the caller to safety, relay the next instruction now, phrased for the situation per your GETTING TO SAFETY rules.)`,
    })
  })

  const mic = await startMicCapture((base64Pcm, level) => {
    // The caller is speaking (transcripts arrive late, after they finish): don't treat a long answer as silence.
    if (level > SPEAKING_LEVEL && !player.isPlaying()) lastActivityAt = Date.now()
    if (!muted) session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
  }, opts.micStream)
  micStop = mic.stop

  const recorder: CallRecorder | null = startCallRecording(mic.stream, player.recordingStream)

  // Epic 10.1: stream ~1 fps camera frames to Gemini so it can see the scene, ask about it, and flag what it sees.
  let frameSampler: FrameSampler | null = null
  if (opts.videoStream) {
    frameSampler = startFrameSampler(opts.videoStream, (base64Jpeg) => {
      if (!finished) session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })
    })
  }

  // Epic 17.1 safety flush: a speaker switch already flushes the previous line, but one speaker talking for a
  // long stretch (e.g. Mia's Round 1 menu options) would otherwise wait indefinitely to appear in the live feed.
  const transcriptFlushTimer = setInterval(() => {
    if (finished) return
    flushTranscript(true)
  }, 5_000)

  const silenceTimer = setInterval(() => {
    if (finished || muted) return
    if (player.isPlaying()) {
      lastActivityAt = Date.now()
      return
    }
    if (Date.now() - lastActivityAt < SILENCE_MS) return
    lastActivityAt = Date.now()
    silentNudges += 1
    if (silentNudges <= 3) {
      session.sendClientContent({
        turns: `(System note, not the caller: the caller has been silent. Silence attempt ${silentNudges} of 3 — follow your SILENCE rule and gently repeat your last question with its meaning. If the caller has just answered it, ignore this note and continue.)`,
      })
    } else if (silentNudges === 4) {
      session.sendClientContent({
        turns: '(System note, not the caller: still no response after 3 attempts. Follow your SILENCE rule now — report it, say goodbye, and call end_call.)',
      })
      // Failsafe in case the model doesn't hang up on its own.
      setTimeout(() => {
        if (finished) return
        enqueueWrite(() => updateLiveFields(db, incidentId, {
          dangerIndicators: ['no response - possibly unable to speak'],
          urgency: 'high',
          notes: 'Caller went silent and did not respond after 3 attempts.',
        }))
        callbacks.onCallEnd()
      }, 20_000)
    }
  }, 1_000)

  return {
    end: async () => {
      finished = true
      flushTranscript(true)
      clearInterval(silenceTimer)
      tracker?.stop()
      clearInterval(transcriptFlushTimer)
      frameSampler?.stop()
      micStop?.()
      const recording = recorder ? await recorder.stop() : null
      player.stop()
      session.close()
      return recording
    },
    toggleMute: () => {
      muted = !muted
      return muted
    },
    getTranscript: () => transcriptLines.map((l) => `${l.speaker}: ${l.text.trim()}`).join('\n'),
  }
}
