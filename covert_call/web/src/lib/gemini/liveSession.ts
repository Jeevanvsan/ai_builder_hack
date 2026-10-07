import { AI_MODELS } from '../../../../shared/aiModels.ts'
import { AI_FEATURES } from '../../../../shared/aiFeatures.ts'
import { FunctionResponseScheduling, MediaResolution, Modality, StartSensitivity, ThinkingLevel, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import { addDoc, arrayRemove, collection, doc, onSnapshot, updateDoc, type Firestore } from 'firebase/firestore'
import { usageFromMetadata } from '../../../../shared/aiModels.ts'
import { INCIDENTS, recordAiUsage, appendTranscriptLine, confirmAddress, markMessageDelivered, recordAdvice, recordCoercionSignal, recordVehicleNumber, subscribeResponderMessages, recordCallerEstimate, recordVoiceStress, reportSceneObservation, updateLiveFields } from '../../../../shared/incidents/client.ts'
import { createAudioPlayer, startMicCapture } from './audio.ts'
import { checkCameraFrame } from './photoVision.ts'
import { startFrameSampler, type FrameSampler } from './frames.ts'
import { PERSONA_SYSTEM_INSTRUCTION } from './persona.ts'
import { ALL_CODES } from '../../../../shared/codes.ts'
import { startCallRecording, type CallRecorder } from './recorder.ts'
import { isCallerMoving, knownFactsNote } from '../../../../shared/incidents/knownFacts.ts'
import type { Incident } from '../../../../shared/incidents/types.ts'
import { LIVE_CALL_TOOLS, SILENT_TOOL_NAMES, batchResponses, toolResponse } from './tools.ts'
import { currentLiveTier, geminiConfigured, liveConnect } from './aiLogic.ts'
import type { MotionKind } from '../../../../shared/incidents/types.ts'
import { startLiveTracking, type LiveTracker } from '../nav/liveTracking.ts'

// The @google/genai SDK's own doc comment names gemini-live-2.5-flash-preview, but that model returned
// "not found for API version v1beta" (error 1008) against a real key — gemini-3.8-live is the current default
// Live API model for low-latency voice agents. Kept as a single constant, not hardcoded elsewhere, so it's easy
// to swap again if the model catalog changes.
// Plain Live is the default: in testing, Extended Thinking dropped the caller's transcript and misheard English,
// with no real latency gain. `?model=extended` opts into Extended Thinking for side-by-side testing.
const USE_PLAIN_LIVE = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('model') === 'extended')
const LIVE_MODEL = USE_PLAIN_LIVE ? AI_MODELS.liveCall : 'gemini-3.8-live-extended-thinking' // shared/aiModels.ts

export type CallStatus = 'connecting' | 'live' | 'ended' | 'failed'

export type LiveCallHandle = {
  end: () => Promise<Blob | null>
  toggleMute: () => boolean
  getTranscript: () => string
  // Epic 30: tells Mia, silently, what the phone's motion sensors felt (running, a grab, a fall).
  noteMotion: (kind: MotionKind) => void
}

// Notes sent into the call when the phone's sensors feel something (Epic 30). Context only, never read out.
const MOTION_NOTES: Partial<Record<MotionKind, string>> = {
  running: 'System note (phone motion sensor, not said by the caller): the caller appears to be RUNNING. If they are getting away, treat them as on the move: report_situation (e.g. "caller running / escaping") and call get_route_guidance. Stay in character.',
  snatched: 'System note (phone motion sensor): the phone was just grabbed or thrown. Do NOT react out loud. If a different person now speaks, keep it a normal food order and keep listening; report_coercion_signal if they try to cancel.',
  fall: 'System note (phone motion sensor): a possible fall or the phone was dropped. If the caller speaks again, check on them gently in character (covert: "all okay with the order?").',
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
  if (!geminiConfigured) throw new Error('Gemini Live is not configured')
  // Epic 27: with Firebase AI Logic on, the call goes through Firebase's proxy (App Check protected) and no Gemini
  // key is in the bundle; otherwise the original key-based connection is used.
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
  // The Live model occasionally voices its own self-check after the real reply ("* *Constraint Checklist &
  // Confidence Score:* 1. Responds in same language? Yes ... Spoken text: \"...\"", INC-MUW7XJDA). The responder
  // view keeps only the words meant for the caller: the quoted spoken text if the leak names it, otherwise
  // everything before the leak starts.
  const LEAK_START = /\*+\s*\*?\s*(constraint checklist|confidence score|mental sandbox|key learnings?)|\bconstraint checklist\b|\bconfidence score\b/i
  const spokenPart = (text: string) => {
    const at = text.search(LEAK_START)
    if (at < 0) return text
    const quoted = [...text.slice(at).matchAll(/(?:spoken text|speech)\s*:?\s*\*?\s*["“]([^"”]{3,})["”]/gi)].at(-1)?.[1]
    return quoted ?? text.slice(0, at)
  }
  const written: number[] = []
  const writeLine = (i: number) => {
    const line = transcriptLines[i]
    const text = (line.speaker === 'Mia' ? spokenPart(line.text) : line.text).replace(/[<{[(]\s*(no speech( detected)?|pause|silen(ce|t)|inaudible|(background )?noise|static|music|breathing|coughs?|laughs?|sighs?)\s*[>}\])]/gi, '').trim()
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
  // Last time Mia reported something from the camera. With the camera on and nothing reported for 20 s, the next
  // tool response asks her to look at the latest frame (she sometimes never mentioned a yellow car that was in
  // every frame, INC-MUWKW3B7).
  let lastSceneAt = 0
  // Camera snaps for the case report: the frame on screen when Mia reports something that matters (a vehicle,
  // person, weapon, injury, fire or a plate). At most 4 per call, 8 s apart.
  let lastFrame: string | null = null
  let snapsTaken = 0
  let lastSnapAt = 0
  const saveSnap = (caption: string) => {
    if (!lastFrame || snapsTaken >= 4 || Date.now() - lastSnapAt < 8_000) return
    snapsTaken++
    lastSnapAt = Date.now()
    const base64 = lastFrame
    void addDoc(collection(db, INCIDENTS, incidentId, 'snaps'), { kind: 'camera', base64, mimeType: 'image/jpeg', at: new Date().toISOString(), caption: caption.slice(0, 300) }).catch(() => {})
  }
  // Case report email: asked once the caller is safe after a danger call. The persona alone didn't make her ask
  // (INC-MUWM64RK ended on "take care"), so the app prompts her once she is quiet.
  let callerSafe = false
  let emailAsked = false
  // An address the caller gave but hasn't confirmed yet, and whether one has been saved.
  let pendingEmail: string | null = null
  let pendingEmailAt = 0
  // Mia has spoken since the address was given (the read-back), so a "yes" now answers "is that right?".
  let emailReadBack = false
  let emailSavedAs: string | null = null
  let emailConfirmedAt = 0
  const saveReportEmail = (email: string) => {
    pendingEmail = null
    emailSavedAs = email
    console.info('[QuickBite call] case report email confirmed:', email)
    enqueueWrite(() => updateDoc(doc(db, INCIDENTS, incidentId), { reportEmail: email }))
  }
  // The caller's "yes" right after the read-back saves Mia's address, even if she forgets the confirming tool call.
  const confirmEmailIfYes = (callerLine: string) => {
    if (!pendingEmail || !emailReadBack || Date.now() - pendingEmailAt > 60_000) return
    const line = callerLine.trim()
    // "Yes. No, no, no. It's wrong, J E E V…" is a correction, not a yes (INC-MUXN9EK5 saved the wrong address).
    if (/\b(no|not|wrong|incorrect|nahi|alla|illa)\b|@|\bat\b/i.test(line)) return
    // The yes is to Mia's LATEST read-back, which may already be a corrected address she never passed to the tool
    // (INC-MUXN9EK5): she saves it herself with confirmed=true; the app doesn't guess which address that was.
    if (/^\W*(yes|yeah|yep|yup|correct|right|that'?s (right|correct)|exactly|haan?|athe|sari)\b/i.test(line)) {
      emailReadBack = false
      extraNotes.push('(The caller said yes to your email read-back: call send_case_report now with confirmed=true and exactly the address you just read back, in name@domain.tld syntax.)')
      const yesAt = Date.now()
      setTimeout(() => { if (!finished && emailConfirmedAt < yesAt) nudge('(System note, not the caller: the caller confirmed the email you read back. Call send_case_report with confirmed=true and exactly that address in name@domain.tld syntax, then carry on.)') }, 2_500)
    }
  }
  const SAFE_NOW = /reached|i'?m safe|i am safe|safe now|(car|they|he|she|him|them|it).{0,25}(gone|left|lost)|lost (him|her|them|the car)|(at|inside|in) the (police|station|hospital)/i
  let sceneDue = false
  let lastAddressSaved: string | null = null
  // Once they're on the move, start the route straight away so it's ready when Mia asks for it.
  const markMoving = () => {
    if (!movementReported) console.info('[QuickBite call] caller is on the move: starting the route')
    movementReported = true
    tracker?.prefetch()
  }
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
  // Last time Mia reported voice stress (see the stress reminder below).
  let lastStressAt = 0
  let finished = false
  // Tracks real socket health (set on onopen/onclose), independent of `finished` (which only means the caller/AI
  // ended the call). Every send must check both — see canSend() below.
  let connected = false
  // Session resumption (Epic 10.1): keep the latest resumption handle and transparently reopen the session if it
  // drops mid-call (video or not).
  let resumptionHandle: string | undefined
  let reconnects = 0
  const MAX_RECONNECTS = 3
  // Hard cap per session on top of the per-drop limit (which resets on each reopen): every reconnect resends the
  // whole persona and tools, so a session that keeps dropping must not reconnect forever.
  let totalReconnects = 0
  const MAX_TOTAL_RECONNECTS = 8

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

  // An email address in spoken text: "jeevan dot v at gmail dot com", "J e e v a n v s a n at gmail.com",
  // "jeevanvsan@gmail.com". Spelled-out letters are joined back together. Null if there is no complete address.
  const emailIn = (raw: string): string | null => {
    const t = raw.toLowerCase()
      .replace(/(?<![\w'’])[a-z0-9](?:[\s,]+[a-z0-9](?![\w'’]))+/g, (run) => run.replace(/[\s,]+/g, ''))
      .replace(/\s+(at|@)\s+/g, '@').replace(/\s*@\s*/g, '@')
      .replace(/\s+(dot|period)\s+/g, '.').replace(/\s+underscore\s+/g, '_').replace(/\s+(dash|hyphen)\s+/g, '-')
    const m = t.match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/)
    const email = m ? m[0].replace(/\.+$/, '') : null
    // A one- or two-letter name is a misparse ("J, E, E, V…" read as "n@gmail.com", INC-MUWOZNEF), not an address.
    return email && email.split('@')[0].length >= 3 ? email : null
  }

  // Runs of 3+ single letters ("J, E, E, V" / "V A Z H") are a spelling, not part of the address. The letters are
  // final: they replace the word(s) just before them that they spell (Niwas → Nivas), then the run is dropped.
  const cleanSpelled = (addr: string): string =>
    addr
      .replace(/(?:\b[A-Za-z]\b[\s,.-]*){3,}/g, (run: string) => `\u0000${run.replace(/[^A-Za-z]/g, '')}\u0000`)
      .replace(/([A-Za-z][A-Za-z ]*?)\s*[,\s]*\u0000([A-Za-z]+)\u0000/g, (_m: string, before: string, letters: string) => {
        const words = before.trim().split(/\s+/)
        for (let k = 1; k <= words.length; k++) {
          const tail = words.slice(-k)
          if (tail.join('').length === letters.length) {
            let i = 0
            const fixed = tail.map((w: string) => { const p = letters.slice(i, i + w.length); i += w.length; return p[0].toUpperCase() + p.slice(1).toLowerCase() })
            return [...words.slice(0, -k), ...fixed].join(' ') + ', '
          }
        }
        return before.trim() + ', '
      })
      .replace(/\u0000[A-Za-z]+\u0000/g, '').replace(/\s+,/g, ',').replace(/,(\s*,)+/g, ',').replace(/\s{2,}/g, ' ').replace(/[\s,]+$/, '').trim()

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
        if (Array.isArray(args.dangerIndicators) && args.dangerIndicators.some((t) => typeof t === 'string' && MOVEMENT.test(t))) markMoving()
        enqueueWrite(() => updateLiveFields(db, incidentId, patch))
        break
      }
      case 'send_case_report': {
        emailAsked = true
        // Mia decides the address: she heard the caller spell it and corrections. Parsing transcripts ourselves
        // picked the wrong one (INC-MUXLVU0X). Only the format is checked here.
        const email = emailIn(String(args.email ?? '').replace(/\s+/g, ''))
        if (!email) return `"${args.email}" is not a valid email address. Pass it in standard syntax: name@domain.tld, lowercase, no spaces, "@" and "." as symbols, e.g. "jeevan.v@gmail.com". If you are unsure of any letter, ask them to spell it once more (name, then the part after the at sign), read it back, then call send_case_report again.`
        // Saved only once the caller confirms the read-back (Mia calling again with confirmed=true, or the caller's
        // own "yes" right after it, see confirmEmailIfYes).
        // confirmed=true only counts after a real yes: INC-MUXNKEBP "confirmed" right after "Can you repeat again?".
        const lastCaller = transcriptLines.filter((l) => l.speaker === 'Caller').at(-1)?.text.trim() ?? ''
        const saidYes = /^\W*(yes|yeah|yep|yup|correct|right|that'?s (right|correct)|exactly|haan?|athe|sari)\b/i.test(lastCaller) && !/\b(no|not|wrong|incorrect|repeat|again)\b|\?/i.test(lastCaller)
        if (args.confirmed === true && !saidYes) {
          pendingEmail = email
          pendingEmailAt = Date.now()
          return `Not confirmed: the caller has not said yes (they said "${lastCaller}"). Read this address back once more, letter by letter for the part before the @: ${email}, and ask "Is that right?". Call send_case_report with confirmed=true only after they say yes.`
        }
        if (args.confirmed === true && (pendingEmail || emailSavedAs)) {
          emailConfirmedAt = Date.now()
          const confirmed = email
          if (confirmed !== emailSavedAs) saveReportEmail(confirmed)
          return `Confirmed and saved: ${confirmed}. Tell them in one short line that the full case report with a reference number will be emailed there after the call.`
        }
        pendingEmail = email
        pendingEmailAt = Date.now()
        emailReadBack = false
        return `Not saved yet. Read exactly this address back, letter by letter for the part before the @: ${email}. Then ask "Is that right?". If they say yes, call send_case_report again with confirmed=true and this same address. If they correct anything, FIRST call send_case_report with the corrected address (their spelled letters are final), then read that back; repeat until they say yes.`
      }
      case 'confirm_address': {
        if (typeof args.address !== 'string') break
        // Mia put her letter-by-letter read-back into the address (INC-MUXNKEBP: "Jeevan Niwas, J, E, E, V…").
        const address = cleanSpelled(args.address)
        if (tooVague(address)) {
          return `NOT saved: "${address}" is too vague to locate. Ask the caller (once, simply) for their area or road and town, then call confirm_address with all of it, e.g. "Indian Oil pump, CCSB Road, Alappuzha".`
        }
        // Saved straight away (latest version wins) so responders have a location even before the read-back.
        // One lookup per distinct address; a failed one is retried once after 3 s (free map server rate limit).
        if (address !== lastAddressSaved) {
          lastAddressSaved = address
          enqueueWrite(async () => {
            const c = await confirmAddress(db, incidentId, address)
            if (c?.lat == null && lastAddressSaved === address) setTimeout(() => enqueueWrite(() => confirmAddress(db, incidentId, address)), 3_000)
          })
        }
        if (args.confirmed !== true) {
          return `Saved for now. If the caller spelled any name letter by letter, use exactly their letters (e.g. "N I V A S" is "Nivas", not "Niwas") and call confirm_address again with that spelling first. Read it back to the caller, spelling every house, building, street and place name letter by letter (e.g. "Jeevan Niwas — J, E, E, V, A, N, N, I, W, A, S"): "${address}". Ask "Is that right?". If they correct anything, call confirm_address again with the corrected address and read it back again; repeat until they say yes, then call confirm_address with confirmed=true.`
        }
        return movementReported
          ? 'Saved. They are on the move — call get_route_guidance now and guide them to the police station/hospital it gives.'
          : 'Saved. Do NOT give directions — they have not said they are being followed or moving. Keep them safe where they are.'
      }
      case 'report_stress_level': {
        lastStressAt = Date.now()
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
        if (source === 'camera') {
          lastSceneAt = Date.now()
          if (['vehicle', 'person', 'weapon', 'injury', 'fire_hazard'].includes(String(args.category)) || args.plate) saveSnap(`${kind}${args.detail ? `: ${args.detail}` : ''}`)
        }
        if ((source === 'camera' || source === 'sound') && typeof kind === 'string') {
          if (/weapon|gun|shot|knife|stab|scream|blood|explosion|fight|attack/i.test(`${kind} ${args.detail ?? ''}`)) dangerReported = true
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
        if (typeof args.text === 'string' && args.text.trim()) enqueueWrite(() => recordAdvice(db, incidentId, args.text as string))
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

  // The call's mode, tracked by the app from what the caller says (Mia was drifting back to food-code questions
  // after "I can speak freely"). Put at the front of every known-facts note, which she already receives as context.
  let openMode = false
  // Has Mia started speaking since the caller last spoke? Decides whether a tool result must start her reply.
  let spokeSinceCaller = false
  // When the caller last spoke, and whether Mia has been nudged for that turn already (reply watchdog below).
  let callerSpokeAt = 0
  // Last time the model did anything (tool call, speech, transcript): it is working on a reply, not stuck.
  let modelActiveAt = 0
  let nudgedForTurn = false
  // A route that arrived after its 6 s budget, waiting for Mia to be quiet.
  let pendingRouteNote = ''
  // Route calls Mia is still waiting on. The watchdog must not send a turn while one is open: a client turn
  // (turnComplete) interrupts the generation that is waiting for that answer.
  let routesPending = 0
  // Tool batches Mia is still waiting on (record-only batches are answered 1.5 s later). No app message may go out
  // while one is open: a client turn sent then left her session stuck, silent for the rest of the call
  // (INC-MUWNW8I9: the email prompt went out in that window, two later nudges got no reply at all).
  let toolsPending = 0
  // Last app message sent to Mia. If she shows no sign of life 10 s after it, the session is stuck and is reopened.
  let nudgeAt = 0
  const nudge = (turns: string) => {
    nudgeAt = Date.now()
    session.sendClientContent({ turns })
  }
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
  // After danger, Mia is told in advance to ask for the report email in the same reply where the caller says they
  // are safe: a prompt sent after that reply came too late (INC-MUWN5ZK9 ended on "take care").
  const EMAIL_NOTE = " (When the caller says they are safe or have arrived, in that same reply ask once for an email address to send their case report to, with a reference number for the police; covert mode: offer to email the order receipt. Call send_case_report with it, read the address back and ask if it is right; only after they say yes call send_case_report again with confirmed=true.)"
  const factsWithMode = (data: Omit<Incident, 'id'>) =>
    (dangerReported && !emailAsked ? EMAIL_NOTE : '') + (openMode ? "(MODE: OPEN — the caller said they can talk freely. For the rest of the call ask plain, direct questions only: NO food words, NO menu codes, NO 'rider', 'order' or sizes. Switch back only if they say they can't talk or someone is coming.) " : '') + knownFactsNote(data)
  let lastIncident: Omit<Incident, 'id'> | undefined

  // AI usage for the staging /ai-usage page: every Live message reports the tokens of the inference that produced
  // it; summed here and written to incidents/{id}.aiUsage.liveCall every 10 s and at the end (Firestore increments).
  const liveUsage = { requests: 0, inText: 0, inAudio: 0, inImage: 0, outText: 0, outAudio: 0 }
  const noteLiveUsage = (m: LiveServerMessage) => {
    if (!m.usageMetadata) return
    const u = usageFromMetadata(m.usageMetadata as never)
    liveUsage.requests++
    liveUsage.inText += u.inText; liveUsage.inAudio += u.inAudio; liveUsage.inImage += u.inImage
    liveUsage.outText += u.outText; liveUsage.outAudio += u.outAudio
  }
  const flushLiveUsage = () => {
    if (!liveUsage.requests) return
    const d = { ...liveUsage }
    for (const k of Object.keys(liveUsage) as (keyof typeof liveUsage)[]) liveUsage[k] = 0
    void recordAiUsage(db, incidentId, 'liveCall', { model: LIVE_MODEL, tier: currentLiveTier(), ...d })
  }
  const usageTimer = setInterval(flushLiveUsage, 10_000)

  const onMessage = (message: LiveServerMessage) => {
    noteLiveUsage(message)
    if (message.toolCall || message.serverContent?.modelTurn || message.serverContent?.outputTranscription) modelActiveAt = Date.now()
    if (import.meta.env.DEV) console.debug('[QuickBite call] message:', message)

    // Speech-to-text for both sides arrives in word-sized fragments (AUDIO-only responses never set message.text).
    const callerText = message.serverContent?.inputTranscription?.text
    if (callerText) {
      appendTranscript('Caller', callerText)
      spokeSinceCaller = false
      callerSpokeAt = Date.now()
      nudgedForTurn = false
      noteMode(callerText)
      confirmEmailIfYes(transcriptLines.at(-1)?.text ?? callerText)
      if (dangerReported && !callerSafe && SAFE_NOW.test(transcriptLines.at(-1)?.text ?? callerText)) {
        callerSafe = true
        if (!emailAsked) extraNotes.push('(The caller just said they are safe: in this reply, ask once for their email for the case report.)')
      }
      lastActivityAt = Date.now()
      silentNudges = 0
      // They spoke again, so "silent after danger" is no longer true: take the tag off the dashboard.
      if (silentTagged && callerText.replace(NON_SPEECH_TOKEN, '').trim()) {
        silentTagged = false
        enqueueWrite(() => updateDoc(doc(db, INCIDENTS, incidentId), { 'extractedFieldsLive.dangerIndicators': arrayRemove(SILENT_TAG) }))
      }
    }
    const miaText = message.serverContent?.outputTranscription?.text
    if (miaText) {
      appendTranscript('Mia', miaText)
      if (/e-?mail/i.test(miaText)) emailAsked = true
    }

    const audioPart = message.serverContent?.modelTurn?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('audio/'))
    if (audioPart?.inlineData?.data) {
      player.play(audioPart.inlineData.data)
      spokeSinceCaller = true
      if (pendingEmail) emailReadBack = true
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
      const facts = takeFacts()
      const outputs = others.map((call, i) => (handleToolCall(call) ?? 'ok') + (i === 0 ? facts : ''))
      // Tools run asynchronously on gemini-3.8-live, so a tool call usually arrives just BEFORE the audio of the
      // same turn. Answering a record-only batch "reply" at that moment made her say the sentence she was already
      // saying a second time (INC-MUWLCO49). Such a batch is answered 1.5 s later instead: silent if her voice has
      // started by then, a reply only if she is still quiet (the tool-only turn the reply exists for).
      const send = () => {
        toolsPending = Math.max(0, toolsPending - 1)
        if (finished) return
        const responses = batchResponses(others, outputs, spokeSinceCaller)
        console.info('[QuickBite call] tools:', responses.map((r) => `${r.name}:${r.scheduling === FunctionResponseScheduling.SILENT ? 'silent' : 'reply'}`).join(', '))
        void session.sendToolResponse({ functionResponses: responses })
        if (responses.some((r) => r.scheduling !== FunctionResponseScheduling.SILENT)) replyStarted()
      }
      const recordOnly = others.every((c) => !!c.name && (SILENT_TOOL_NAMES.has(c.name) || c.name === 'end_call'))
      const replyQueued = others.length > 0 && !recordOnly
      if (others.length) {
        toolsPending += 1
        if (recordOnly && !spokeSinceCaller) setTimeout(send, 1_500)
        else send()
      }
      // Route guidance needs a real answer (live GPS + routing), so it's answered once the tracker resolves.
      for (const call of routeCalls) {
        const args = (call.args ?? {}) as { situation?: string; landmark?: string }
        // Mia's own situation text counts only if it says the CALLER is followed/chased/moving ("attacker on bike" doesn't).
        if (args.situation && MOVEMENT.test(args.situation)) markMoving()
        if (!movementReported) {
          const silent = replyQueued || spokeSinceCaller
          if (!silent) replyStarted()
          void session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, scheduling: silent ? FunctionResponseScheduling.SILENT : FunctionResponseScheduling.WHEN_IDLE, response: { output: 'NOT needed: the caller has not said they are being followed, chased or on the move. Do NOT give any directions or mention a route. A vehicle answer describes the ATTACKER, not the caller moving. If they are inside (home, a room), ask the CAN THEY GET OUT question first. Only if they can get out safely, or say they are being followed: report_situation with that (e.g. \"caller escaping - leaving the house\"), then call this again.' } }] })
          continue
        }
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
    liveConnect({
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
            'QuickBite', 'Mia', 'talk', 'order',
            // Every code phrase plus the answers to Mia's follow-ups, so a whispered "cola" isn't heard as "Kola".
            ...ALL_CODES.map((c) => c.food),
            'cola', 'lemon', 'orange', 'a few napkins', 'a whole pack', 'small', 'medium', 'large', 'one pizza', 'two pizzas',
            'a few', 'hand it to me', 'leave it at the door', 'right now', 'pre-order', 'as soon as possible', 'within the hour',
            'whenever', 'pick up', 'bike', 'car', 'barbecue', 'mayo', 'ketchup', 'regular crust', 'large crust', 'the usual',
            'collect it outside', 'bring it in', 'for myself', 'for someone else', 'one address', 'moving around',
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
        // Sliding-window compression on every call, not just video: without it the whole conversation (and every
        // second of mic audio) is re-read on each turn, so cost and latency grow with the call.
        // Keep the session lean: compress from ~48K tokens down to ~28K (the default only starts at 80% of the 131K
        // window, so it never ran and every re-read kept growing). System instructions are always kept.
        contextWindowCompression: { triggerTokens: '48000', slidingWindow: { targetTokens: '28000' } },
        // Camera frames at low media resolution (~70 tokens per frame on Gemini 3 instead of ~280).
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
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
          if (!finished && reconnects < MAX_RECONNECTS && totalReconnects < MAX_TOTAL_RECONNECTS) {
            totalReconnects += 1
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
    // Delivered by the reply guard timer once Mia is quiet: a client turn interrupts whatever she is saying.
    pendingRouteNote = note
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
    if (callerMoving || movementReported) markMoving()
    lastIncident = data
    pendingFacts = factsWithMode(data)
  })
  // Known facts (and the open/covert mode) used to go out as their own sendClientContent with turnComplete false.
  // That leaves the conversation turn OPEN, and Gemini then ignored the caller's voice until the next
  // turn-completing message (the 25 s stress nudge): replies came 20-25 s late (INC-MUVHTZYU). Now the facts ride
  // along with things Mia already gets: every tool result and the stress nudge. No extra message, no open turn.
  let stressDue = false
  let estimateDue = false
  const extraNotes: string[] = []
  const takeFacts = () => {
    const parts: string[] = []
    if (pendingFacts && pendingFacts !== lastFacts) { lastFacts = pendingFacts; parts.push(pendingFacts) }
    if (stressDue) { stressDue = false; lastStressAt = Date.now(); parts.push("(Also call report_stress_level silently with your current 0-100 estimate of the caller's vocal stress.)") }
    if (extraNotes.length) parts.push(...extraNotes.splice(0))
    if (sceneDue) { sceneDue = false; lastSceneAt = Date.now(); parts.push('(Also look at the latest camera frame now: if a vehicle, person, weapon, injury, fire or readable number plate is visible, call report_scene_observation silently with its category and details: colour, type, plate. Night and low light are normal: a dark silhouette, shadow or outline of a person counts as a person.)') }
    if (estimateDue) { estimateDue = false; parts.push("(Also call report_caller_estimate silently with your best guess of the caller's age group and gender.)") }
    return parts.length ? ` ${parts.join(' ')}` : ''
  }
  const factsTimer = setInterval(() => { /* kept for the cleanup list; facts are delivered by takeFacts() */ }, 60_000)

  // Epic 22.4: a real order call is one to three minutes. At 2:30 Mia is nudged to wrap up, unless the caller is
  // moving or chased (then the call is a lifeline and stays open). Never an automatic hang-up.
  // Two time notes: wrap up at 2:00, say goodbye and end at 3:00 (the call should end by about 3-3.5 min). Mia ends
  // the call herself; the app never hangs up. A caller being chased or hiding is the only exception.
  const WRAP_UP_MS = 120_000
  const END_NOW_MS = 180_000
  const callStartedAt = Date.now()
  let budgetNoted = false
  let endNoted = false
  const budgetTimer = setInterval(() => {
    if (!canSend() || toolsPending > 0 || routesPending > 0 || player.isPlaying()) return
    const elapsed = Date.now() - callStartedAt
    if (!budgetNoted && elapsed >= WRAP_UP_MS) {
      budgetNoted = true
      session.sendClientContent({
        turns: '(System note, not the caller — time: the call is 2 minutes long. Start wrapping up per your TIME BUDGET rule: at most one more essential question, then close. If they are being chased or hiding right now, keep helping them instead. Say only the words meant for the caller.)',
      })
      return
    }
    // An email being taken or confirmed is finished first (up to 45 s more): the goodbye note cut off the
    // read-back of the address the caller had just given (INC-MUXOMIEH).
    const lastMia = [...transcriptLines].reverse().find((l) => l.speaker === 'Mia')?.text ?? ''
    const emailOpen = (pendingEmail !== null && emailConfirmedAt < pendingEmailAt) || /e-?mail/i.test(lastMia)
    if (emailOpen && elapsed < END_NOW_MS + 45_000) return
    if (budgetNoted && !endNoted && elapsed >= END_NOW_MS) {
      endNoted = true
      clearInterval(budgetTimer)
      session.sendClientContent({
        turns: '(System note, not the caller — time: the call is 3 minutes long. End now: if an email was just given, first read it back and get a yes (send_case_report confirmed=true); then one short, warm goodbye in the disguise, then call end_call. Only if they are being chased or hiding from someone right now, stay with them and end the moment they are safe. Say only the words meant for the caller.)',
      })
    }
  }, 5_000)

  // Epic 23: responder -> caller messages. Each pending message is injected once, on a pause (never while Mia is
  // talking), and Mia confirms delivery with confirm_message_delivered.
  const injectedMessages = new Set<string>()
  let queuedMessages: { id: string; text: string }[] = []
  const unsubMessages = subscribeResponderMessages(db, incidentId, (messages) => {
    queuedMessages = messages.filter((m) => m.status === 'pending' && !injectedMessages.has(m.id)).map((m) => ({ id: m.id, text: m.text }))
  })
  const messageTimer = setInterval(() => {
    if (!canSend() || toolsPending > 0 || routesPending > 0 || player.isPlaying()) return
    const next = queuedMessages.shift()
    if (!next || injectedMessages.has(next.id)) return
    injectedMessages.add(next.id)
    session.sendClientContent({
      turns: `(System note, not the caller — responder message ${next.id}: "${next.text}". Pass it on to the caller on this turn as ordinary delivery chat, per your RESPONDER MESSAGES rule, then call confirm_message_delivered with this id and exactly what you said. Say only the words meant for the caller.)`,
    })
  }, 1_000)

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
      lastFrame = base64Jpeg
      if (canSend()) session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })
    })
  }

  // Backup camera check (see checkCameraFrame): every 8 s, the latest frame goes to a vision model; each new kind of
  // thing it finds is recorded as if Mia had reported it, and she gets a note so she can use it.
  const seenOnCamera = new Set<string>()
  let frameCheckBusy = false
  const frameCheckTimer = opts.videoStream ? setInterval(() => {
    if (finished || frameCheckBusy || !lastFrame) return
    frameCheckBusy = true
    void checkCameraFrame(lastFrame).then((found) => {
      for (const f of found) {
        const key = `${f.category}:${f.kind.toLowerCase()}`
        if (finished || seenOnCamera.has(key)) continue
        seenOnCamera.add(key)
        handleToolCall({ name: 'report_scene_observation', args: { source: 'camera', confidence: 70, ...f } } as FunctionCall)
        extraNotes.push(`(Camera check, not the caller: ${f.detail}. Use it in your questions if it helps; never say aloud what you see.)`)
      }
    }).catch(() => {}).finally(() => { frameCheckBusy = false })
  }, 8_000) : null

  // Epic 17.1 safety flush: a speaker switch already flushes the previous line, but one speaker talking for a
  // long stretch (e.g. Mia's Round 1 menu options) would otherwise wait indefinitely to appear in the live feed.
  const transcriptFlushTimer = setInterval(() => {
    if (finished) return
    flushTranscript(true)
  }, 5_000)

  // Sent only while Mia isn't talking, so it doesn't interrupt her; retried every 5s until it goes out once.
  // Voice stress is only as regular as the model remembers to report it, and in testing a 2-minute call produced
  // none. If 25 s pass with no reading while the caller is talking, nudge for one, during a pause only.
  // Voice stress is only as regular as the model remembers to report it. Every 25 s (once the caller has spoken) a
  // request rides on the next silent tool response. It used to be its own turnComplete=true message, and per the
  // Live API docs that unconditionally interrupts the model: it cut Mia off mid-sentence.
  // Reply watchdog: whatever the cause (a turn of only tool calls, a lost response), the caller is never left waiting
  // more than ~6 s after they finish speaking. One nudge per caller turn, only while Mia is quiet.
  const REPLY_WAIT_MS = 8_000
  const replyGuardTimer = setInterval(() => {
    if (!canSend()) return
    if (nudgeAt && modelActiveAt < nudgeAt && Date.now() - nudgeAt > 10_000) {
      nudgeAt = 0
      console.warn('[QuickBite call] Mia has not responded for 10 s: reopening the session')
      session.close() // onclose reconnects with the resumption handle and tells her to carry on
      return
    }
    if (nudgeAt && modelActiveAt >= nudgeAt) nudgeAt = 0
    if (toolsPending > 0) return
    if (pendingRouteNote && !player.isPlaying() && routesPending === 0) {
      const note = pendingRouteNote
      pendingRouteNote = ''
      console.info('[QuickBite call] navigation note:', note.slice(0, 90))
      nudge(`(System note, not the caller — live navigation: ${note} Relay it now, phrased for the situation. Say only the words meant for the caller.)`)
      return
    }
    if (callerSafe && !emailAsked && spokeSinceCaller && routesPending === 0 && !player.isPlaying() && Date.now() - modelActiveAt > 600) {
      emailAsked = true
      console.info('[QuickBite call] caller safe: asking for the case report email')
      nudge("(System note, not the caller: the caller is safe now. Before the call ends, ask them ONCE for an email address to send their full case report to, with a reference number they can show the police (covert mode: offer to email the order receipt). Read it back, then call send_case_report. If they decline, don't ask again. Say only the words meant for the caller.)")
      return
    }
    if (!callerSpokeAt || spokeSinceCaller || nudgedForTurn || routesPending > 0 || player.isPlaying()) return
    if (Date.now() - Math.max(callerSpokeAt, modelActiveAt) < REPLY_WAIT_MS) return
    nudgedForTurn = true
    console.info('[QuickBite call] reply watchdog: caller waiting, nudging Mia')
    nudge('(System note, not the caller: the caller finished speaking and is waiting. Reply to what they just said, briefly. Say only the words meant for the caller.)')
  }, 1_000)

  const stressTimer = setInterval(() => {
    if (!transcriptLines.some((l) => l.speaker === 'Caller')) return
    // First reading soon after the caller first speaks (the dashboard card was empty for the first ~30 s), then every 25 s.
    if (lastStressAt ? Date.now() - lastStressAt >= 25_000 : Date.now() - callStartedAt >= 5_000) stressDue = true
    if (opts.videoStream && Date.now() - Math.max(lastSceneAt, callStartedAt) >= 20_000) sceneDue = true
  }, 5_000)

  const estimateTimer = setInterval(() => {
    // Paused for the prototype (shared/aiFeatures.ts): no estimate nudge, Mia may still report it herself.
    if (finished || estimateReported || !AI_FEATURES.callerEstimateNudge) { clearInterval(estimateTimer); return }
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
    if (Date.now() - lastActivityAt < SILENCE_MS || toolsPending > 0 || routesPending > 0) return
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
        turns: `(System note, not the caller: the caller has been silent. Silence attempt ${silentNudges} of 3 — follow your SILENCE rule and gently repeat your last question with its meaning. If the caller has just answered it, ignore this note and continue. Say only the words meant for the caller.)`,
      })
    } else if (silentNudges === 4) {
      session.sendClientContent({
        turns: '(System note, not the caller: still no response after 3 attempts, and nothing dangerous has been reported this call. Follow your SILENCE rule now — report it, say goodbye, and call end_call. Say only the words meant for the caller.)',
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
      clearInterval(factsTimer)
      clearInterval(stressTimer)
      clearInterval(replyGuardTimer)
      clearInterval(budgetTimer)
      clearInterval(messageTimer)
      clearInterval(usageTimer)
      flushLiveUsage()
      unsubIncident()
      unsubMessages()
      tracker?.stop()
      clearInterval(transcriptFlushTimer)
      frameSampler?.stop()
      if (frameCheckTimer) clearInterval(frameCheckTimer)
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
    noteMotion: (kind) => {
      // Running from the sensors counts as "on the move", so route guidance is allowed even if not said yet.
      if (kind === 'running') markMoving()
      const note = MOTION_NOTES[kind]
      // Rides on the next silent tool response (takeFacts): a turnComplete=false message would hold the turn open.
      if (note) extraNotes.push(note)
    },
  }
}
