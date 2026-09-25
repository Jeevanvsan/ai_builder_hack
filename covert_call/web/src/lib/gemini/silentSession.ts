import { GoogleGenAI, Modality, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai'
import type { Firestore } from 'firebase/firestore'
import { recordVoiceStress, reportSceneObservation, updateLiveFields } from '../../../../shared/incidents/client.ts'
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
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey) throw new Error('Gemini Live is not configured')

  const client = new GoogleGenAI({ apiKey })
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
    }
  }

  const onMessage = (message: LiveServerMessage) => {
    const heard = message.serverContent?.inputTranscription?.text
    if (heard) transcriptLines.push(heard)
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

  const openSession = (resume?: string) =>
    client.live.connect({
      model: LIVE_MODEL,
      config: {
        // TEXT, not AUDIO: the observer must never speak into the room. We ignore the text; the value is the tool
        // calls and the transcription of what it hears.
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: {},
        systemInstruction: SILENT_OBSERVER_INSTRUCTION,
        tools: REPORT_SCENE_OBSERVATION_TOOLS,
        // An SOS can run long and carries video, so compress the context and keep a resumption handle to reopen on
        // a drop.
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: resume ? { handle: resume } : {},
      },
      callbacks: {
        onopen: () => {},
        onmessage: onMessage,
        onerror: (e) => console.error('[QuickBite SOS] observer error:', e),
        onclose: () => {
          if (!finished && resumptionHandle && reconnects < MAX_RECONNECTS) {
            reconnects += 1
            void openSession(resumptionHandle).then((s) => { session = s }).catch(() => {})
          }
        },
      },
    })

  session = await openSession()

  const mic = await startMicCapture((base64Pcm) => {
    if (!finished) session.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } })
  }, opts.micStream)

  // One frame sampler per camera (front + back). Both feed the same observer.
  const samplers: FrameSampler[] = opts.videoStreams.map((stream) =>
    startFrameSampler(stream, (base64Jpeg) => {
      if (!finished) session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })
    }),
  )

  // Nudge it to start observing immediately.
  session.sendClientContent({ turns: 'A silent SOS has started. Begin observing and reporting through tools now.' })

  return {
    end: async () => {
      finished = true
      samplers.forEach((s) => s.stop())
      mic.stop()
      session.close()
    },
    getTranscript: () => transcriptLines.join(' ').trim(),
  }
}
