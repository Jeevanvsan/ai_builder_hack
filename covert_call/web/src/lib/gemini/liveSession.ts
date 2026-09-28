import { GoogleGenAI, Modality, StartSensitivity, ThinkingLevel, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import { arrayRemove, doc, updateDoc, type Firestore } from 'firebase/firestore'
import { INCIDENTS, appendTranscriptLine, confirmAddress, recordAdvice, recordCallerEstimate, recordVoiceStress, reportSceneObservation, updateLiveFields } from '../../../../shared/incidents/client.ts'
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
  // Fired when the connection drops and every reconnect attempt has failed (or failed before ever getting a
  // resumption handle) — a genuine, unrecoverable disconnection, distinct from a normal hangup. The page must
  // still close out the incident (save the recording, run consolidation, mark it ended) exactly as if the caller
  // had said goodbye, since otherwise it's left stuck 'active' forever with nothing telling a responder why.
  onCallDropped: () => void
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
  // includeLast: the periodic safety timer also flushes a still-growing last line (good enough for a live view,
  // re-appended as a fresh Firestore entry each time it grows) — a real speaker switch, by contrast, only ever
  // flushes completed lines, since the switch itself is the signal that the previous line is truly done.
  // Each line remembers how much of it has been written. A finished line is written once in full; the still-open
  // last line is re-written only when it has grown (the dashboard shows the newest version of a growing line).
  // Previously a periodic flush marked the open line as done, so the rest of the caller's sentence (which
  // arrives in fragments, often after Mia starts replying) was never written and lines appeared cut off.
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
  // The transcription API sometimes emits bracketed non-speech annotations instead of actual words —
  // "<no speech>", "{pause}", "[silence]", "(inaudible)" — for a quiet stretch or breathing. These arrive as
  // their own fragments (sometimes several concatenated back to back, e.g. "<no speech>{pause}") and are
  // transcription artifacts, not something either side said — strip them out per fragment, not just when a
  // whole line happens to be only one, since consecutive fragments get merged into the same line before this
  // would otherwise be checked. Previously leaked straight into the responder-facing conversation view looking
  // like Mia or the caller had spoken gibberish.
  const NON_SPEECH_TOKEN = /[<{[(]\s*(no speech|pause|silen(ce|t)|inaudible|(background )?noise|static|music|breathing|coughs?|laughs?|sighs?)\s*[>}\])]|-{2,}/gi
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

  // Gemini Live only takes a turn after it hears the caller, so silence never makes it speak on its own.
  // This watchdog nudges it to re-ask after a quiet gap, and hangs up itself if the model doesn't after 3 tries.
  // 20 s: callers (and demo role-play voices) often take a while to answer after a long direction.
  const SILENCE_MS = 20_000
  const SPEAKING_LEVEL = 0.02
  let lastActivityAt = Date.now()
  let silentNudges = 0
  // Set only once the caller has said they're being followed/chased or are on the move. Route guidance is gated on
  // it: a caller hiding at home who describes the ATTACKER's bike was being routed to a police station.
  let movementReported = false
  const SILENT_TAG = 'caller silent after danger - line kept open'
  let silentTagged = false
  const MOVEMENT = /(followed|chased|chasing|stalked|stalking|fleeing|escaping)|following (me|her|him|them|the caller)|on the move|moving around|abduct|taken somewhere|running away|in the road|leaving the (house|home|room|building)/i
  // True once anything dangerous has been reported this call (a weapon, a gunshot/scream heard, high urgency).
  // Silence after that point is a reason to stay connected, not the ordinary "no answer, end the call" case —
  // see the silence timer below and persona.ts's SILENCE section.
  let dangerReported = false
  // The model often never files the age/gender estimate on its own (the persona asks for it "once, early"), so a
  // one-off reminder goes out once the caller has spoken for a while — see the estimate timer below.
  let estimateReported = false
  let finished = false
  // Tracks real socket health (set on onopen/onclose), independent of `finished` (which only means the caller/AI
  // ended the call). Every send must check both — see canSend() below.
  let connected = false
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

  // A bare landmark ("petrol pump", "bus stop") geocodes to a random place of that type — it once put an
  // Alappuzha caller at a petrol pump in Kochi. Those are rejected so Mia asks for the area/road and town.
  const GENERIC_PLACE = /\b(petrol|fuel|pump|shop|store|sign ?(board|post)|junction|bus ?stop|signal|market|temple|church|mosque|school|hospital|road|street|lane|building|bridge|beach|park|near|here)\b/i
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
        // Once real danger has been reported, going silent is a reason to STAY on the line, not hang up — see
        // the silence-timer guard below. Never reset back to false: danger doesn't un-happen mid-call.
        if (args.urgency === 'high' || (Array.isArray(args.dangerIndicators) && args.dangerIndicators.length)) dangerReported = true
        // Danger tags only, never free-text notes ("follow-up" in a note matched and routed a caller hiding at home).
        if (Array.isArray(args.dangerIndicators) && args.dangerIndicators.some((t) => typeof t === 'string' && MOVEMENT.test(t))) movementReported = true
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
        return movementReported
          ? 'Saved. They are on the move — call get_route_guidance now and guide them to the police station/hospital it gives.'
          : 'Saved. Do NOT give directions — they have not said they are being followed or moving. Keep them safe where they are.'
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
          estimateReported = true
          enqueueWrite(() => recordCallerEstimate(db, incidentId, {
            ageGroup: ageGroup as 'child' | 'teen' | 'adult' | 'elderly' | 'unclear',
            gender: gender as 'male' | 'female' | 'unclear',
            confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
          }))
        }
        break
      }
      case 'report_scene_observation': {
        const source = args.source
        const kind = args.kind
        if ((source === 'camera' || source === 'sound') && typeof kind === 'string') {
          if (/weapon|gun|shot|knife|stab|scream|blood|explosion|fight|attack/i.test(`${kind} ${args.detail ?? ''}`)) dangerReported = true
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
        // The tool call can arrive before its own closing-line audio has finished playing (or even before
        // playback has started at all, e.g. still buffering) — a fixed timeout was a guess that cut a longer
        // goodbye off mid-sentence. Poll the player's actual queue instead: wait for it to start (in case the
        // audio hasn't begun yet) then for it to finish, with a hard cap so a stuck flag can never hang the call.
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
          // Not playing yet — could be "already finished" or "hasn't started". Give it a short window to start
          // before concluding there's nothing left to wait for.
          if (elapsed < 800) { setTimeout(waitForPlaybackToFinish, POLL_MS); return }
          callbacks.onCallEnd()
        }
        setTimeout(waitForPlaybackToFinish, POLL_MS)
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
      // They spoke again, so "silent after danger" is no longer true: take the tag off the dashboard.
      if (silentTagged && callerText.replace(NON_SPEECH_TOKEN, '').trim()) {
        silentTagged = false
        enqueueWrite(() => updateDoc(doc(db, INCIDENTS, incidentId), { 'extractedFieldsLive.dangerIndicators': arrayRemove(SILENT_TAG) }))
      }
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
      const outputs = others.map((call) => handleToolCall(call) ?? 'ok')
      if (others.length) {
        void session.sendToolResponse({
          functionResponses: others.map((call, i) => ({ id: call.id, name: call.name, response: { output: outputs[i] } })),
        })
      }
      // Route guidance needs a real answer (live GPS + routing), so it's answered once the tracker resolves.
      for (const call of routeCalls) {
        const args = (call.args ?? {}) as { situation?: string; landmark?: string }
        // Mia's own situation text counts only if it says the CALLER is followed/chased/moving ("attacker on bike" doesn't).
        if (args.situation && MOVEMENT.test(args.situation)) movementReported = true
        if (!movementReported) {
          void session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { output: 'NOT needed: the caller has not said they are being followed, chased or on the move. Do NOT give any directions or mention a route. A vehicle answer describes the ATTACKER, not the caller moving. If they are inside (home, a room), ask the CAN THEY GET OUT question first. Only if they can get out safely, or say they are being followed: report_situation with that (e.g. \"caller escaping - leaving the house\"), then call this again.' } }] })
          continue
        }
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
        // Hints for the caller-side speech-to-text: likely languages (short words were being detected as German or
        // Spanish) and local place names / code words that were being misheard ("Vazhicherry" → "Veterinary").
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
        // Session resumption lets a dropped connection (bad signal, a backgrounded tab, a network blip) reopen
        // transparently instead of silently ending the call — this used to be video-only, but a dropped
        // audio-only call is the far more common real case and previously had NO reconnect at all: onclose just
        // fired 'ended' straight away with no attempt to call back. `resume` carries the handle when reconnecting.
        sessionResumption: resume ? { handle: resume } : {},
        // Compression genuinely only matters for video (a shorter session cap with audio+video together); keep
        // audio-only calls on the exact proven config otherwise.
        ...(useVideo ? { contextWindowCompression: { slidingWindow: {} } } : {}),
      },
      callbacks: {
        // onopen can fire before `client.live.connect()`'s own promise resolves and assigns `session` below —
        // sending the greeting nudge from here throws (session is still undefined). Just flip status here;
        // the greeting itself is sent right after the `await` completes instead, once `session` definitely exists.
        onopen: () => { connected = true; reconnects = 0; callbacks.onStatusChange('live') },
        onmessage: onMessage,
        onerror: (e) => {
          console.error('[QuickBite call] Gemini Live error:', e)
          callbacks.onStatusChange('failed')
        },
        onclose: (e) => {
          connected = false
          console.warn('[QuickBite call] Gemini Live closed:', e?.code, e?.reason)
          // A session that drops before the caller has actually ended the call is reopened transparently —
          // audio-only calls now get this too (see sessionResumption above), since a dropped connection with
          // nobody calling back is exactly the failure this feature exists for. Reconnect even without a
          // resumption handle: a quiet stretch on the call can hit Gemini's own idle timeout (a clean 1000 close)
          // before the server ever sends a sessionResumptionUpdate, so requiring a handle here could leave a
          // legitimately-still-connected caller stranded. `finished` (set by the End button or the model's own
          // end_call) is what actually distinguishes a real hangup from a drop — not whether a handle arrived yet.
          if (!finished && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            callbacks.onStatusChange('connecting')
            void openSession(resumptionHandle)
              .then((s) => {
                session = s
                // Reconnecting mid-conversation needs a nudge (the model has no memory of "we just reconnected")
                // so Mia picks the thread back up instead of greeting the caller again as if this were a new call.
                s.sendClientContent({
                  turns: '(System note, not the caller: the connection dropped briefly and has just reconnected. Do NOT greet them again or restart the call — say one short line like "sorry, I lost you for a second — are you still there?" and continue exactly where you left off.)',
                })
              })
              .catch(() => {
                if (!finished) callbacks.onCallDropped()
              })
            return
          }
          // Ran out of reconnect attempts — this is a real, unrecoverable disconnection, not a normal hangup.
          // Previously this just flipped local UI state to 'ended' with nothing telling CallPage to actually
          // close out the incident: the recording was never saved, consolidation never ran, and the incident
          // stayed callState:'active' on Firestore forever with no way for a responder to tell a genuine drop
          // apart from a call that's merely gone quiet.
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
    // Nearby help existing (or a responder picking a station) is never a reason to start directing someone:
    // only a caller who is on the road, chased or leaving gets turn-by-turn guidance. The route still shows on
    // the dashboard for the responder either way.
    if (finished || !movementReported) return
    session.sendClientContent({
      turns: `(System note, not the caller — live navigation: ${note} If you are guiding the caller to safety, relay the next instruction now, phrased for the situation per your GETTING TO SAFETY rules.)`,
    })
  })

  const canSend = () => connected && !finished

  const mic = await startMicCapture((base64Pcm, level) => {
    // The caller is speaking (transcripts arrive late, after they finish): don't treat a long answer as silence.
    if (level > SPEAKING_LEVEL && !player.isPlaying()) lastActivityAt = Date.now()
    // Previously gated only on !muted, with no check that the socket was actually alive — the same class of bug
    // just fixed in silentSession.ts (SOS): if the connection drops and can't reconnect, every mic frame kept
    // hitting a dead socket for the rest of the call, spamming "WebSocket is already in CLOSING or CLOSED state".
    if (!muted && canSend()) session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
  }, opts.micStream)
  micStop = mic.stop

  const recorder: CallRecorder | null = startCallRecording(mic.stream, player.recordingStream)

  // Epic 10.1: stream ~1 fps camera frames to Gemini so it can see the scene, ask about it, and flag what it sees.
  let frameSampler: FrameSampler | null = null
  if (opts.videoStream) {
    frameSampler = startFrameSampler(opts.videoStream, (base64Jpeg) => {
      if (canSend()) session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })
    })
  }

  // Epic 17.1 safety flush: a speaker switch already flushes the previous line, but one speaker talking for a
  // long stretch (e.g. Mia's Round 1 menu options) would otherwise wait indefinitely to appear in the live feed.
  const transcriptFlushTimer = setInterval(() => {
    if (finished) return
    flushTranscript(true)
  }, 5_000)

  // Sent only while Mia isn't talking, so it doesn't interrupt her; retried every 5s until it goes out once.
  const estimateTimer = setInterval(() => {
    if (finished || estimateReported) { clearInterval(estimateTimer); return }
    const callerLines = transcriptLines.filter((l) => l.speaker === 'Caller').length
    if (callerLines < 2 || player.isPlaying()) return
    clearInterval(estimateTimer)
    session.sendClientContent({
      turns: '(System note, not the caller: you have heard the caller\'s voice. Call report_caller_estimate NOW with your best guess of their age group and gender — silently, do not say anything about it and do not change what you were doing. If you were mid-conversation, just continue exactly where you were.)',
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
    // re-ask made her say "Still there? I'm still listening" out loud over and over during an armed attack,
    // which can give the caller away. Instead: one instruction to go quiet, then no more nudges — she speaks only
    // when the caller speaks, and the line stays open for the responder listening live.
    if (dangerReported) {
      if (silentNudges === 1) {
        silentTagged = true
        enqueueWrite(() => updateLiveFields(db, incidentId, {
          dangerIndicators: [SILENT_TAG],
          urgency: 'high',
        }))
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
      // Failsafe in case the model doesn't hang up on its own. Re-checks dangerReported at fire time too, in
      // case danger gets reported in the 20s between this nudge and the failsafe running.
      setTimeout(() => {
        if (finished || dangerReported) return
        enqueueWrite(() => updateLiveFields(db, incidentId, {
          dangerIndicators: ['no response - possibly unable to speak'],
          urgency: 'high',
          notes: 'Caller went silent and did not respond after 3 attempts.',
        }))
        callbacks.onCallEnd()
      }, 20_000)
    }
  }, 1_000)

  let ended = false
  return {
    end: async () => {
      // Both the End button and the model's own end_call tool call reach here (see onCallEnd above) — they can
      // race each other close together. session.close() on an already-closing socket spams "WebSocket is already
      // in CLOSING or CLOSED state" into the console for every subsequent chunk; guard so teardown runs once.
      if (ended) return null
      ended = true
      finished = true
      flushTranscript(true)
      clearInterval(silenceTimer)
      clearInterval(estimateTimer)
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
