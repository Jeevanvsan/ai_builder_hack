import {
  GoogleGenAI,
  Modality,
  StartSensitivity,
  type FunctionCall,
  type LiveServerMessage,
  type Session,
} from '@google/genai'
import type { Firestore } from 'firebase/firestore'
import {
  appendTranscriptLine,
  confirmAddress,
  recordAdvice,
  recordCallerEstimate,
  recordVoiceStress,
  reportSceneObservation,
  updateLiveFields,
} from '../../../../shared/incidents/client'
// The persona, the tool declarations and the live GPS tracker are imported from the web app rather than copied.
// They contain no browser-only code, and the persona in particular changes often — a copy here would silently
// drift from the one the web call uses, which is exactly the parity problem this port has to avoid.
import { PERSONA_SYSTEM_INSTRUCTION } from '../../../../web/src/lib/gemini/persona'
import { LIVE_CALL_TOOLS } from '../../../../web/src/lib/gemini/tools'
import { startLiveTracking, type LiveTracker } from '../../../../web/src/lib/nav/liveTracking'
import { startMicCapture, createAudioPlayer, type MicHandle, type Player } from '../platform/audio'
import { startCallRecording, type CallRecorder } from './recorder'
import type { FrameSource } from '../../../modules/qb-frames'
import { GEMINI_API_KEY } from '../config'

// Native port of web/src/lib/gemini/liveSession.ts — keep the two in sync.
//
// Everything below the transport is copied from the web unchanged: the tool handling, the address-vagueness
// check, transcript batching, the silence watchdog, the caller-estimate nudge, reconnection, and waiting for
// the goodbye to finish playing before the call actually ends. What differs is only how audio gets in and out
// (see lib/platform/audio.ts) and how the recording is produced (see recorder.ts).
//
// The web's `?model=extended` switch is web-only; native always uses plain Live, which is the proven default.
const LIVE_MODEL = 'gemini-3.8-live'

export type CallStatus = 'connecting' | 'live' | 'ended' | 'failed'

export type CallRecording = { base64: string; mimeType: string }

export type LiveCallHandle = {
  end: () => Promise<CallRecording | null>
  toggleMute: () => boolean
  getTranscript: () => string
}

type LiveCallCallbacks = {
  onStatusChange: (status: CallStatus) => void
  // Fired when the model calls end_call — the screen reacts exactly as it does to the End button.
  onCallEnd: () => void
  // Fired when the connection drops and every reconnect attempt has failed. A genuine, unrecoverable
  // disconnection, distinct from a normal hangup: the screen must still close the incident out, or it sits
  // 'active' forever with nothing telling a responder why it went quiet.
  onCallDropped: () => void
}

export async function startLiveCall(
  db: Firestore,
  incidentId: string,
  callbacks: LiveCallCallbacks,
  // Optional camera stills. With them the model can describe what it sees; without, the call is audio-only and
  // everything else behaves the same.
  opts: { frames?: FrameSource | null } = {},
): Promise<LiveCallHandle> {
  if (!GEMINI_API_KEY) throw new Error('Gemini Live is not configured')

  const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  let tracker: LiveTracker | null = null
  const player: Player = createAudioPlayer()
  let muted = false
  let mic: MicHandle | null = null
  const transcriptLines: { speaker: string; text: string }[] = []

  // Flush a completed line to Firestore on a speaker switch (the previous speaker's line is now "done"), plus a
  // periodic safety flush so a long stretch from one speaker doesn't wait forever to appear live. Fragments
  // arrive word-sized, so writing every fragment would be far too write-heavy.
  let lastFlushedIndex = -1
  const written: number[] = []
  const writeLine = (i: number) => {
    const line = transcriptLines[i]
    const text = line.text.trim()
    if (!text || (written[i] ?? 0) >= line.text.length) return
    written[i] = line.text.length
    const speaker = line.speaker === 'Mia' ? 'Mia' : 'Caller'
    enqueueWrite(() => appendTranscriptLine(db, incidentId, speaker, text))
  }
  const flushTranscript = (includeLast = false) => {
    const upTo = includeLast ? transcriptLines.length : transcriptLines.length - 1
    for (let i = Math.max(0, lastFlushedIndex); i < upTo; i++) writeLine(i)
    lastFlushedIndex = Math.max(lastFlushedIndex, transcriptLines.length - 2)
  }

  // The transcription API sometimes emits bracketed non-speech annotations instead of words — "<no speech>",
  // "{pause}", "[silence]" — for a quiet stretch or breathing. They're artifacts, not something either side
  // said, and they used to leak into the responder-facing conversation view looking like gibberish.
  const NON_SPEECH_TOKEN = /[<{[(]\s*(no speech|pause|silence|inaudible|noise|breathing|laughs?|sighs?)\s*[>}\])]/gi
  const appendTranscript = (speaker: string, rawText: string) => {
    const text = rawText.replace(NON_SPEECH_TOKEN, '')
    if (!text) return
    const last = transcriptLines.at(-1)
    if (last?.speaker === speaker) last.text += text
    else {
      transcriptLines.push({ speaker, text })
      flushTranscript() // writes the previous line in full now that it's finished
    }
  }

  // Gemini Live only takes a turn after it hears the caller, so silence never makes it speak on its own. This
  // watchdog nudges it to re-ask after a quiet gap, and hangs up itself if the model doesn't after 3 tries.
  const SILENCE_MS = 12_000
  const SPEAKING_LEVEL = 0.02
  let lastActivityAt = Date.now()
  let silentNudges = 0
  // True once anything dangerous has been reported. Silence after that is a reason to stay connected, not the
  // ordinary "no answer, end the call" case.
  let dangerReported = false
  let estimateReported = false
  let finished = false
  // Real socket health, independent of `finished` (which only means the caller/AI ended the call).
  let connected = false
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3

  // Gemini can fire several tool calls back-to-back within one turn; two overlapping transactions on the same
  // document race and one loses with `failed-precondition`. Queuing keeps writes strictly sequential without
  // slowing the conversation (they're fire-and-forget either way).
  let writeQueue: Promise<unknown> = Promise.resolve()
  const enqueueWrite = (write: () => Promise<unknown>) => {
    writeQueue = writeQueue.then(write, write)
  }

  // A bare landmark ("petrol pump", "bus stop") geocodes to a random place of that type — it once put an
  // Alappuzha caller at a petrol pump in Kochi. Rejected so Mia asks for the area/road and town.
  const GENERIC_PLACE =
    /\b(petrol|fuel|pump|shop|store|sign ?(board|post)|junction|bus ?stop|signal|market|temple|church|mosque|school|hospital|road|street|lane|building|bridge|beach|park|near|here)\b/i
  const tooVague = (a: string) => {
    const words = a.trim().split(/\s+/).filter(Boolean)
    return words.length < 2 ? !/[A-Z]/.test(a) || GENERIC_PLACE.test(a) : !a.includes(',') && words.length <= 3 && GENERIC_PLACE.test(a)
  }

  // Returns the tool response text for calls whose answer matters to the model; undefined means plain "ok".
  const handleToolCall = (call: FunctionCall): string | undefined => {
    const args = (call.args ?? {}) as Record<string, unknown>
    switch (call.name) {
      case 'report_situation': {
        const patch: Record<string, unknown> = {}
        if (typeof args.peopleCount === 'number') patch.peopleCount = args.peopleCount
        if (Array.isArray(args.dangerIndicators)) patch.dangerIndicators = args.dangerIndicators
        if (typeof args.urgency === 'string') patch.urgency = args.urgency
        if (typeof args.notes === 'string') patch.notes = args.notes
        // Never reset to false: danger doesn't un-happen mid-call.
        if (args.urgency === 'high' || (Array.isArray(args.dangerIndicators) && args.dangerIndicators.length)) {
          dangerReported = true
        }
        enqueueWrite(() => updateLiveFields(db, incidentId, patch))
        break
      }
      case 'confirm_address': {
        const address = args.address
        if (typeof address !== 'string') break
        if (tooVague(address)) {
          return `NOT saved: "${address}" is too vague to locate. Ask the caller (once, simply) for their area or road and town, then call confirm_address with all of it, e.g. "Indian Oil pump, CCSB Road, Alappuzha".`
        }
        enqueueWrite(() => confirmAddress(db, incidentId, address))
        return 'Saved. If they are being chased, followed or need to move, call get_route_guidance now and guide them to the police station/hospital it gives.'
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
          estimateReported = true
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
      case 'report_scene_observation': {
        const source = args.source
        const kind = args.kind
        if ((source === 'camera' || source === 'sound') && typeof kind === 'string') {
          if (/weapon|gun|shot|knife|stab|scream|blood|explosion|fight|attack/i.test(`${kind} ${args.detail ?? ''}`)) {
            dangerReported = true
          }
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
        if (typeof args.text === 'string' && args.text.trim()) {
          enqueueWrite(() => recordAdvice(db, incidentId, args.text as string))
        }
        break
      }
      case 'end_call': {
        // The tool call can arrive before its own closing-line audio has finished playing, or even before
        // playback has started. Poll the player's actual queue instead of guessing a timeout, with a hard cap so
        // a stuck flag can never hang the call.
        finished = true
        const HARD_CAP_MS = 12_000
        const POLL_MS = 150
        const startedAt = Date.now()
        const waitForPlaybackToFinish = () => {
          const elapsed = Date.now() - startedAt
          if (player.isPlaying()) {
            if (elapsed < HARD_CAP_MS) setTimeout(waitForPlaybackToFinish, POLL_MS)
            else callbacks.onCallEnd()
            return
          }
          // Not playing yet — could be "already finished" or "hasn't started". Give it a short window to start.
          if (elapsed < 800) {
            setTimeout(waitForPlaybackToFinish, POLL_MS)
            return
          }
          callbacks.onCallEnd()
        }
        setTimeout(waitForPlaybackToFinish, POLL_MS)
        break
      }
    }
  }

  const onMessage = (message: LiveServerMessage) => {
    if (__DEV__) console.debug('[QuickBite call] message:', message)

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

    // Interruption is normal mid-conversation barge-in, not the end of the call — only clear what's queued.
    // player.stop() would close the audio output permanently on the first interruption.
    if (message.serverContent?.interrupted) player.clearQueue()

    const newHandle = message.sessionResumptionUpdate?.newHandle
    if (newHandle) resumptionHandle = newHandle

    const calls = message.toolCall?.functionCalls
    if (calls?.length) {
      const routeCalls = calls.filter((c) => c.name === 'get_route_guidance')
      const others = calls.filter((c) => c.name !== 'get_route_guidance')
      const outputs = others.map((call) => handleToolCall(call) ?? 'ok')
      if (others.length) {
        void session.sendToolResponse({
          functionResponses: others.map((call, i) => ({ id: call.id, name: call.name, response: { output: outputs[i] } })),
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
        // "Kore" reads as a female voice, matching the persona's name ("Mia"). Deliberately no
        // speechConfig.languageCode: locking one would stop the model switching languages mid-call when the
        // caller does, which persona.ts's LANGUAGE rule requires.
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        // AUDIO-only responseModalities never populates message.text, so these two turn on Gemini's own
        // speech-to-text for both directions — without them the transcript is silently empty every time, which
        // breaks consolidation downstream. The hints cover languages and local place names that were being
        // misheard ("Vazhicherry" → "Veterinary").
        inputAudioTranscription: {
          languageCodes: ['en-IN', 'ml-IN', 'hi-IN', 'ta-IN'],
          customVocabulary: [
            'QuickBite', 'Mia', 'talk', 'order', 'garlic bread', 'pepperoni', 'extra spicy', 'kids meal', 'family combo',
            'Alappuzha', 'Alleppey', 'Vazhicherry', 'Muhamma', 'Mullakkal', 'Kalavoor', 'Cherthala', 'Kochi', 'Ernakulam',
            'Kottayam', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Bengaluru', 'HSR Layout', 'Koramangala',
            'petrol pump', 'junction', 'police station',
          ],
        },
        outputAudioTranscription: {},
        // Scared callers pause mid-answer. Low end-sensitivity + a longer silence window stop Gemini taking its
        // turn in those pauses; low start-sensitivity stops Mia's own voice leaking from the loudspeaker from
        // counting as the caller barging in. That matters more on native than on the web, since the default
        // audio backend doesn't engage the phone's echo canceller (see config.ts).
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            prefixPaddingMs: 200,
            silenceDurationMs: 700,
          },
        },
        systemInstruction: PERSONA_SYSTEM_INSTRUCTION,
        tools: LIVE_CALL_TOOLS,
        // Lets a dropped connection (bad signal, a backgrounded app, a network blip) reopen transparently
        // instead of silently ending the call.
        sessionResumption: resume ? { handle: resume } : {},
      },
      callbacks: {
        // onopen can fire before connect()'s own promise resolves and assigns `session`, so only flip status
        // here; the greeting is sent after the await below, once `session` definitely exists.
        onopen: () => {
          connected = true
          reconnects = 0
          callbacks.onStatusChange('live')
        },
        onmessage: onMessage,
        onerror: (e) => {
          console.error('[QuickBite call] Gemini Live error:', e)
          callbacks.onStatusChange('failed')
        },
        onclose: (e) => {
          connected = false
          console.warn('[QuickBite call] Gemini Live closed:', e?.code, e?.reason)
          // Reconnect even without a resumption handle: a quiet stretch can hit Gemini's idle timeout (a clean
          // 1000 close) before the server ever sends one, and requiring a handle would strand a caller who is
          // still there. `finished` is what distinguishes a real hangup from a drop.
          if (!finished && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            callbacks.onStatusChange('connecting')
            void openSession(resumptionHandle)
              .then((s) => {
                session = s
                // The model has no memory of "we just reconnected", so nudge it to pick the thread back up
                // instead of greeting the caller again as if this were a new call.
                s.sendClientContent({
                  turns: '(System note, not the caller: the connection dropped briefly and has just reconnected. Do NOT greet them again or restart the call — say one short line like "sorry, I lost you for a second — are you still there?" and continue exactly where you left off.)',
                })
              })
              .catch(() => {
                if (!finished) callbacks.onCallDropped()
              })
            return
          }
          if (!finished) callbacks.onCallDropped()
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

  const canSend = () => connected && !finished

  // One recording for the whole call: the caller's mic and Mia's replies mixed on a single timeline.
  const recorder: CallRecorder = startCallRecording()
  player.onPcm((pcm, rate) => recorder.addAi(pcm, rate))

  mic = await startMicCapture((base64Pcm, level, pcm) => {
    // The recording gets every frame regardless of mute, so the evidence reflects what the room actually
    // sounded like even across a stretch the caller muted.
    recorder.addMic(pcm)
    // The caller is speaking (transcripts arrive late, after they finish): don't treat a long answer as silence.
    if (level > SPEAKING_LEVEL && !player.isPlaying()) lastActivityAt = Date.now()
    // Checks the socket is actually alive, not just that nobody ended the call — otherwise, once a connection
    // drops for good, every mic frame keeps hitting a dead socket for the rest of the session.
    if (!muted && canSend()) {
      session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
    }
  })

  // Gemini Live takes video as periodic stills, not a stream, so a still a second is exactly its own cadence.
  // A session carrying video hits a shorter cap than an audio-only one; the reconnect path above already covers
  // that, and its counter resets on every successful reopen, so a long call still survives.
  const frameTimer = opts.frames
    ? setInterval(() => {
        if (finished) return
        const jpeg = opts.frames?.grab()
        if (jpeg && canSend()) session.sendRealtimeInput({ video: { data: jpeg, mimeType: 'image/jpeg' } })
      }, 1_000)
    : null

  // A speaker switch already flushes the previous line, but one speaker talking for a long stretch would
  // otherwise wait indefinitely to appear in the live feed.
  const transcriptFlushTimer = setInterval(() => {
    if (finished) return
    flushTranscript(true)
  }, 5_000)

  // The model often never files the age/gender estimate on its own, so remind it once the caller has spoken for
  // a while. Sent only while Mia isn't talking, so it doesn't interrupt her.
  const estimateTimer = setInterval(() => {
    if (finished || estimateReported) {
      clearInterval(estimateTimer)
      return
    }
    const callerLines = transcriptLines.filter((l) => l.speaker === 'Caller').length
    if (callerLines < 2 || player.isPlaying()) return
    clearInterval(estimateTimer)
    session.sendClientContent({
      turns: "(System note, not the caller: you have heard the caller's voice. Call report_caller_estimate NOW with your best guess of their age group and gender — silently, do not say anything about it and do not change what you were doing. If you were mid-conversation, just continue exactly where you were.)",
    })
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
    // After danger, silence usually means the caller is hiding or the attacker is right there. Nudging Mia to
    // re-ask made her say "still there?" out loud repeatedly during an armed attack, which can give the caller
    // away. Instead: one instruction to go quiet, then no more nudges — the line stays open for the responder.
    if (dangerReported) {
      if (silentNudges === 1) {
        enqueueWrite(() =>
          updateLiveFields(db, incidentId, {
            dangerIndicators: ['caller silent after danger - line kept open'],
            urgency: 'high',
          }),
        )
        session.sendClientContent({
          turns: '(System note, not the caller: the caller has gone silent after danger was reported — they may be hiding or the attacker may be right there. Say NOTHING now. Do not check in, do not ask "still there", do not repeat yourself. Stay completely silent and keep listening; only speak again when the caller speaks to you. Keep reporting sounds you hear with report_scene_observation. Never call end_call.)',
        })
      }
      return
    }
    if (silentNudges <= 3) {
      session.sendClientContent({
        turns: `(System note, not the caller: the caller has been silent. Silence attempt ${silentNudges} of 3 — follow your SILENCE rule and gently repeat your last question with its meaning. If the caller has just answered it, ignore this note and continue.)`,
      })
    } else if (silentNudges === 4) {
      session.sendClientContent({
        turns: '(System note, not the caller: still no response after 3 attempts, and nothing dangerous has been reported this call. Follow your SILENCE rule now — report it, say goodbye, and call end_call.)',
      })
      // Failsafe in case the model doesn't hang up on its own. Re-checks dangerReported at fire time, in case
      // danger gets reported in the 20s between this nudge and the failsafe running.
      setTimeout(() => {
        if (finished || dangerReported) return
        enqueueWrite(() =>
          updateLiveFields(db, incidentId, {
            dangerIndicators: ['no response - possibly unable to speak'],
            urgency: 'high',
            notes: 'Caller went silent and did not respond after 3 attempts.',
          }),
        )
        callbacks.onCallEnd()
      }, 20_000)
    }
  }, 1_000)

  let ended = false
  return {
    end: async () => {
      // Both the End button and the model's own end_call reach here and can race. Closing an already-closing
      // socket floods the log with "WebSocket is already in CLOSING or CLOSED state", so teardown runs once.
      if (ended) return null
      ended = true
      finished = true
      flushTranscript(true)
      clearInterval(silenceTimer)
      clearInterval(estimateTimer)
      clearInterval(transcriptFlushTimer)
      if (frameTimer) clearInterval(frameTimer)
      opts.frames?.stop()
      tracker?.stop()
      mic?.stop()
      const recording = recorder.stop()
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
