import { AI_MODELS } from '../../../../shared/aiModels'
import { AI_FEATURES } from '../../../../shared/aiFeatures'
import { geminiKeys, liveConnectWithFallback } from './keys'
import {
  GoogleGenAI,
  FunctionResponseScheduling,
  Modality,
  StartSensitivity,
  type FunctionCall,
  type LiveServerMessage,
  type Session,
  MediaResolution,
} from '@google/genai'
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import {
  INCIDENTS,
  appendTranscriptLine,
  confirmAddress,
  markMessageDelivered, recordAdvice, recordCoercionSignal, recordVehicleNumber, subscribeResponderMessages,
  recordCallerEstimate,
  recordVoiceStress,
  reportSceneObservation,
  updateLiveFields,
} from '../../../../shared/incidents/client'
// The persona, the tool declarations and the live GPS tracker are imported from the web app rather than copied.
// They contain no browser-only code, and the persona in particular changes often — a copy here would silently
// drift from the one the web call uses, which is exactly the parity problem this port has to avoid.
import { PERSONA_SYSTEM_INSTRUCTION } from '../../../../web/src/lib/gemini/persona'
import { isCallerMoving, knownFactsNote } from '../../../../shared/incidents/knownFacts'
import type { Incident } from '../../../../shared/incidents/types'
import { LIVE_CALL_TOOLS, batchResponses, toolResponse } from '../../../../web/src/lib/gemini/tools'
import { startLiveTracking, type LiveTracker } from '../../../../web/src/lib/nav/liveTracking'
import { startMicCapture, createAudioPlayer, type MicHandle, type Player } from '../platform/audio'
import { startCallRecording, type CallRecorder } from './recorder'
import type { FrameSource } from '../../../modules/qb-frames'

// A camera still every 2 s (web: frames.ts FRAMES_PER_SECOND = 0.5).
const FRAME_INTERVAL_MS = 2_000

// Native port of web/src/lib/gemini/liveSession.ts — keep the two in sync.
//
// Everything below the transport is copied from the web unchanged: the tool handling, the address-vagueness
// check, transcript batching, the silence watchdog, the caller-estimate nudge, reconnection, and waiting for
// the goodbye to finish playing before the call actually ends. What differs is only how audio gets in and out
// (see lib/platform/audio.ts) and how the recording is produced (see recorder.ts).
//
// The web's `?model=extended` switch is web-only; native always uses plain Live, which is the proven default.
const LIVE_MODEL = AI_MODELS.liveCall // shared/aiModels.ts

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
  if (!geminiKeys.configured) throw new Error('Gemini Live is not configured')
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
    const text = line.text.replace(/[<{[(]\s*(no speech( detected)?|pause|silen(ce|t)|inaudible|(background )?noise|static|music|breathing|coughs?|laughs?|sighs?)\s*[>}\])]/gi, '').trim()
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
  // Minimum mic level treated as a real interruption while Mia is speaking (see the echo guard below). Tuned
  // blind — if a caller finds they cannot cut in mid-sentence, lower it; if Mia's voice still reaches the
  // transcript as the caller, raise it.
  const BARGE_IN_LEVEL = 0.08
  let lastActivityAt = Date.now()
  let silentNudges = 0
  // True once anything dangerous has been reported. Silence after that is a reason to stay connected, not the
  // ordinary "no answer, end the call" case.
  let dangerReported = false
  let estimateReported = false
  // Last time Mia reported voice stress (see the stress reminder below).
  let lastStressAt = 0
  let finished = false
  // Real socket health, independent of `finished` (which only means the caller/AI ended the call).
  let connected = false
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3
  // Hard cap per session on top of the per-drop limit (which resets on each reopen): every reconnect resends the
  // whole persona and tools, so a session that keeps dropping must not reconnect forever.
  let totalReconnects = 0
  const MAX_TOTAL_RECONNECTS = 8

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
        lastStressAt = Date.now()
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
              category: typeof args.category === 'string' ? args.category : undefined,
              vehicle: { type: args.vehicleType as string | undefined, colour: args.colour as string | undefined, plate: args.plate as string | undefined },
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
      case 'report_vehicle_number': {
        const plate = args.plate
        const source = args.source === 'camera' ? 'camera' : 'caller'
        if (typeof plate === 'string' && plate.trim()) {
          enqueueWrite(() => recordVehicleNumber(db, incidentId, { value: plate, source, confidence: typeof args.confidence === 'number' ? args.confidence : undefined }))
        }
        break
      }
      case 'report_coercion_signal': {
        if (typeof args.kind === 'string') {
          const confidence = typeof args.confidence === 'number' ? args.confidence : undefined
          // A confident coercion sign is danger: silence afterwards keeps the line open, like any other danger.
          if ((confidence ?? 0) >= 60) dangerReported = true
          enqueueWrite(() => recordCoercionSignal(db, incidentId, { kind: args.kind as string, detail: typeof args.detail === 'string' ? args.detail : undefined, confidence }))
        }
        break
      }
      case 'confirm_message_delivered': {
        if (typeof args.messageId === 'string' && typeof args.spokenAs === 'string') {
          enqueueWrite(() => markMessageDelivered(db, incidentId, args.messageId as string, args.spokenAs as string))
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

  // The call's mode, tracked by the app from what the caller says (Mia was drifting back to food-code questions
  // after "I can speak freely"). Put at the front of every known-facts note, which she already receives as context.
  let openMode = false
  // Has Mia started speaking since the caller last spoke? Decides whether a tool result must start her reply.
  let spokeSinceCaller = false
  // When the caller last spoke, and whether Mia has been nudged for that turn already (reply watchdog below).
  let callerSpokeAt = 0
  let nudgedForTurn = false
  // A route that arrived after its 6 s budget, waiting for Mia to be quiet.
  let pendingRouteNote = ''
  // Route calls Mia is still waiting on. The watchdog must not send a turn while one is open: a client turn
  // (turnComplete) interrupts the generation that is waiting for that answer.
  let routesPending = 0
  // A tool response that starts Mia's reply restarts the watchdog clock, so it never nudges while that reply is
  // being generated (generation takes 1-2 s before the first audio arrives).
  const replyStarted = () => { if (callerSpokeAt && !spokeSinceCaller) callerSpokeAt = Date.now() }
  let callerHeard = ''
  const OPEN_SIGNAL = /\b(talk|speak)\b[^.?!]{0,15}\bfreely\b|\bi can (talk|speak)\b|\bi'?m alone\b|\bno one(?:'s| is) (here|around)\b|^\s*talk\b/i
  const COVERT_SIGNAL = /\b(can'?t|cannot) (talk|speak)\b|\bsomeone(?:'s| is) coming\b|\b(he|she|they)(?:'s|'re| is| are) (here|back|close|coming)\b/i
  const noteMode = (text: string) => {
    callerHeard = `${callerHeard} ${text}`.slice(-160)
    const before = openMode
    if (OPEN_SIGNAL.test(callerHeard)) openMode = true
    if (COVERT_SIGNAL.test(callerHeard)) openMode = false
    if (before !== openMode) { callerHeard = ''; if (lastIncident) pendingFacts = factsWithMode(lastIncident) }
  }
  const factsWithMode = (data: Omit<Incident, 'id'>) =>
    (openMode ? "(MODE: OPEN — the caller said they can talk freely. For the rest of the call ask plain, direct questions only: NO food words, NO menu codes, NO 'rider', 'order' or sizes. Switch back only if they say they can't talk or someone is coming.) " : '') + knownFactsNote(data)
  let lastIncident: Omit<Incident, 'id'> | undefined

  const onMessage = (message: LiveServerMessage) => {
    if (__DEV__) console.debug('[QuickBite call] message:', message)

    // Speech-to-text for both sides arrives in word-sized fragments (AUDIO-only responses never set message.text).
    const callerText = message.serverContent?.inputTranscription?.text
    if (callerText) {
      appendTranscript('Caller', callerText)
      spokeSinceCaller = false
      callerSpokeAt = Date.now()
      nudgedForTurn = false
      noteMode(callerText)
      lastActivityAt = Date.now()
      silentNudges = 0
    }
    const miaText = message.serverContent?.outputTranscription?.text
    if (miaText) appendTranscript('Mia', miaText)

    const audioPart = message.serverContent?.modelTurn?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('audio/'))
    if (audioPart?.inlineData?.data) {
      player.play(audioPart.inlineData.data)
      spokeSinceCaller = true
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
      const facts = takeFacts()
      const outputs = others.map((call, i) => (handleToolCall(call) ?? 'ok') + (i === 0 ? facts : ''))
      const responses = batchResponses(others, outputs, spokeSinceCaller)
      const replyQueued = responses.some((r) => r.scheduling !== FunctionResponseScheduling.SILENT)
      if (responses.length) {
        console.info('[QuickBite call] tools:', responses.map((r) => `${r.name}:${r.scheduling === FunctionResponseScheduling.SILENT ? 'silent' : 'reply'}`).join(', '))
        void session.sendToolResponse({ functionResponses: responses })
        if (replyQueued) replyStarted()
      }
      // Route guidance needs a real answer (live GPS + routing), so it's answered once the tracker resolves.
      for (const call of routeCalls) {
        const args = (call.args ?? {}) as { situation?: string; landmark?: string }
        // Mia often waits for the directions before she speaks, so the route must always answer quickly: within
        // ROUTE_BUDGET_MS she gets either the route or a holding instruction. A route that arrives later is relayed by
        // the reply guard timer as soon as she is quiet (never interrupting her). A route lookup that never finished left her
        // silent until the watchdog fired (INC-MUW73RZ6).
        const ROUTE_BUDGET_MS = 6_000
        let answered = false
        routesPending++
        const answer = (output: string) => {
          if (answered) return
          answered = true
          routesPending = Math.max(0, routesPending - 1)
          if (finished) return
          console.info('[QuickBite call] route answered:', output.slice(0, 90))
          void session.sendToolResponse({ functionResponses: [toolResponse(call, output, false)] })
          replyStarted()
        }
        const budget = setTimeout(() => answer('Route still being worked out (a few seconds). Right now: tell them to keep moving towards a busy, well-lit place (a shop, petrol pump, crowd) and ask ONCE for a landmark or road name they can see. The directions will follow as a system note: relay them when they come.'), ROUTE_BUDGET_MS)
        void (tracker ? tracker.guidance(args.situation, args.landmark) : Promise.resolve('No GPS yet — ask for the nearest landmark.'))
          .catch(() => 'Routing is unavailable right now — ask for the nearest landmark and keep them moving somewhere busy and lit.')
          .then((output) => {
            clearTimeout(budget)
            if (!answered) answer(output)
            else pendingRouteNote = output
          })
      }
    }
  }

  let session: Session
  callbacks.onStatusChange('connecting')

  const openSession = (resume?: string) =>
    liveConnectWithFallback({
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
        // Sliding-window compression on every call (as on web): otherwise the whole conversation, audio and frames
        // are re-read on each turn, so cost and latency grow with the call.
        // Keep the session lean: compress from ~48K tokens down to ~28K (the default only starts at 80% of the 131K
        // window, so it never ran and every re-read kept growing). System instructions are always kept.
        contextWindowCompression: { triggerTokens: '48000', slidingWindow: { targetTokens: '28000' } },
        // Camera frames at low media resolution (~70 tokens per frame on Gemini 3 instead of ~280).
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
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
          if (!finished && reconnects < MAX_RECONNECTS && totalReconnects < MAX_TOTAL_RECONNECTS) {
            totalReconnects += 1
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

  // Epic 22.2: tell Mia what is already known (from the caller, the camera and background sound) so she never
  // asks for it again. Delivered on the silent tool responses (takeFacts), never as its own message, and
  // only when the summary actually changes, at most every 8 s and never while she is talking.
  let lastFacts = ''
  let pendingFacts = ''
  let callerMoving = false
  const unsubIncident = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    const data = snap.data() as Omit<Incident, 'id'> | undefined
    if (!data) return
    callerMoving = isCallerMoving(data)
    lastIncident = data
    pendingFacts = factsWithMode(data)
  })
  // Known facts (and the open/covert mode) used to go out as their own sendClientContent with turnComplete false.
  // That leaves the conversation turn OPEN, and Gemini then ignored the caller's voice until the next
  // turn-completing message (the 25 s stress nudge): replies came 20-25 s late (INC-MUVHTZYU). Now the facts ride
  // along with things Mia already gets: every tool result and the stress nudge. No extra message, no open turn.
  let stressDue = false
  let estimateDue = false
  const takeFacts = () => {
    const parts: string[] = []
    if (pendingFacts && pendingFacts !== lastFacts) { lastFacts = pendingFacts; parts.push(pendingFacts) }
    if (stressDue) { stressDue = false; lastStressAt = Date.now(); parts.push("(Also call report_stress_level silently with your current 0-100 estimate of the caller's vocal stress.)") }
    if (estimateDue) { estimateDue = false; parts.push("(Also call report_caller_estimate silently with your best guess of the caller's age group and gender.)") }
    return parts.length ? ` ${parts.join(' ')}` : ''
  }
  const factsTimer = setInterval(() => { /* kept for the cleanup list; facts are delivered by takeFacts() */ }, 60_000)

  // Epic 22.4: a real order call is one to three minutes. At 2:30 Mia is nudged to wrap up, unless the caller is
  // moving or chased (then the call is a lifeline and stays open). Never an automatic hang-up.
  const CALL_BUDGET_MS = 150_000
  const callStartedAt = Date.now()
  let budgetNoted = false
  const budgetTimer = setInterval(() => {
    if (budgetNoted || !canSend() || Date.now() - callStartedAt < CALL_BUDGET_MS || player.isPlaying()) return
    budgetNoted = true
    clearInterval(budgetTimer)
    if (callerMoving) return
    session.sendClientContent({
      turns: '(System note, not the caller — time budget: the call is about two and a half minutes long. If the minimum facts are known and you are not guiding them to safety or relaying a responder message, start wrapping up naturally now, per your TIME BUDGET rule. If the caller is still in danger or mid-answer, carry on and wrap up when it is safe.)',
    })
  }, 5_000)

  // Epic 23: responder -> caller messages. Each pending message is injected once, on a pause (never while Mia is
  // talking), and Mia confirms delivery with confirm_message_delivered.
  const injectedMessages = new Set<string>()
  let queuedMessages: { id: string; text: string }[] = []
  const unsubMessages = subscribeResponderMessages(db, incidentId, (messages) => {
    queuedMessages = messages.filter((m) => m.status === 'pending' && !injectedMessages.has(m.id)).map((m) => ({ id: m.id, text: m.text }))
  })
  const messageTimer = setInterval(() => {
    if (!canSend() || player.isPlaying()) return
    const next = queuedMessages.shift()
    if (!next || injectedMessages.has(next.id)) return
    injectedMessages.add(next.id)
    session.sendClientContent({
      turns: `(System note, not the caller — responder message ${next.id}: "${next.text}". Pass it on to the caller on this turn as ordinary delivery chat, per your RESPONDER MESSAGES rule, then call confirm_message_delivered with this id and exactly what you said.)`,
    })
  }, 1_000)

  // One recording for the whole call: the caller's mic and Mia's replies mixed on a single timeline.
  const recorder: CallRecorder = startCallRecording()
  player.onPcm((pcm, rate) => recorder.addAi(pcm, rate))

  mic = await startMicCapture((base64Pcm, level, pcm) => {
    // The recording gets every frame regardless of mute, so the evidence reflects what the room actually
    // sounded like even across a stretch the caller muted.
    recorder.addMic(pcm)
    // The caller is speaking (transcripts arrive late, after they finish): don't treat a long answer as silence.
    if (level > SPEAKING_LEVEL && !player.isPlaying()) lastActivityAt = Date.now()

    // Echo guard. The phone's own canceller does the real work; this is the backstop for what leaks past it.
    // Whatever gets through arrives while Mia is speaking and is much quieter than a person talking into the
    // handset — so while playback is active, only audio loud enough to be a genuine interruption is forwarded.
    // Without this, her greeting came back through the mic and Gemini transcribed it as the CALLER, which then
    // read as the caller interrupting and made her restart the sentence.
    //
    // Deliberately a level gate rather than muting outright: someone who needs to cut in mid-sentence is
    // exactly the person this call exists for, and silencing them for the whole of Mia's turn is the worse
    // failure. BARGE_IN_LEVEL sits well above room tone and leaked playback, below normal speech.
    const echoLikely = player.isPlaying() && level < BARGE_IN_LEVEL

    // Checks the socket is actually alive, not just that nobody ended the call — otherwise, once a connection
    // drops for good, every mic frame keeps hitting a dead socket for the rest of the session.
    if (!muted && !echoLikely && canSend()) {
      session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
    }
  })

  // Gemini Live takes video as periodic stills, not a stream. One every 2 s, same as web: each frame is ~258 tokens
  // that stay in the context, so 1 fps made video the biggest cost of a call.
  // A session carrying video hits a shorter cap than an audio-only one; the reconnect path above already covers
  // that, and its counter resets on every successful reopen, so a long call still survives.
  const frameTimer = opts.frames
    ? setInterval(() => {
        if (finished) return
        const jpeg = opts.frames?.grab()
        if (jpeg && canSend()) session.sendRealtimeInput({ video: { data: jpeg, mimeType: 'image/jpeg' } })
      }, FRAME_INTERVAL_MS)
    : null

  // A speaker switch already flushes the previous line, but one speaker talking for a long stretch would
  // otherwise wait indefinitely to appear in the live feed.
  const transcriptFlushTimer = setInterval(() => {
    if (finished) return
    flushTranscript(true)
  }, 5_000)

  // The model often never files the age/gender estimate on its own, so remind it once the caller has spoken for
  // a while. Sent only while Mia isn't talking, so it doesn't interrupt her.
  // Voice stress is only as regular as the model remembers to report it, and in testing a 2-minute call produced
  // none. If 25 s pass with no reading while the caller is talking, nudge for one, during a pause only.
  // Voice stress is only as regular as the model remembers to report it. Every 25 s (once the caller has spoken) a
  // request rides on the next silent tool response. It used to be its own turnComplete=true message, and per the
  // Live API docs that unconditionally interrupts the model: it cut Mia off mid-sentence. (Same as web.)
  // Reply watchdog: whatever the cause (a turn of only tool calls, a lost response), the caller is never left waiting
  // more than ~6 s after they finish speaking. One nudge per caller turn, only while Mia is quiet.
  const REPLY_WAIT_MS = 6_000
  const replyGuardTimer = setInterval(() => {
    if (!canSend()) return
    if (pendingRouteNote && !player.isPlaying()) {
      const note = pendingRouteNote
      pendingRouteNote = ''
      console.info('[QuickBite call] relaying late route')
      session.sendClientContent({ turns: `(System note, not the caller — live navigation, the route is ready: ${note} Relay the first direction now, phrased for the situation.)` })
      return
    }
    if (!callerSpokeAt || spokeSinceCaller || nudgedForTurn || routesPending > 0 || player.isPlaying()) return
    if (Date.now() - callerSpokeAt < REPLY_WAIT_MS) return
    nudgedForTurn = true
    console.info('[QuickBite call] reply watchdog: caller waiting, nudging Mia')
    session.sendClientContent({ turns: '(System note, not the caller: the caller finished speaking and is waiting. Answer them now, briefly, following your instructions.)' })
  }, 1_000)

  const stressTimer = setInterval(() => {
    if (!transcriptLines.some((l) => l.speaker === 'Caller')) return
    if (Date.now() - Math.max(lastStressAt, callStartedAt) >= 25_000) stressDue = true
  }, 5_000)

  const estimateTimer = setInterval(() => {
    // Paused for the prototype (shared/aiFeatures.ts): no estimate nudge, Mia may still report it herself.
    if (finished || estimateReported || !AI_FEATURES.callerEstimateNudge) {
      clearInterval(estimateTimer)
      return
    }
    const callerLines = transcriptLines.filter((l) => l.speaker === 'Caller').length
    if (callerLines < 2 || player.isPlaying()) return
    clearInterval(estimateTimer)
    estimateDue = true // rides on the next silent tool response, like the stress request
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
      clearInterval(factsTimer)
      clearInterval(stressTimer)
      clearInterval(replyGuardTimer)
      clearInterval(budgetTimer)
      clearInterval(messageTimer)
      unsubIncident()
      unsubMessages()
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
