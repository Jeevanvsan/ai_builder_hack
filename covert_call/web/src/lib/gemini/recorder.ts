// Records the full call (both the caller's mic and the AI's spoken responses) into one compact audio file, for
// later evidence/verification. Uses MediaRecorder with Opus — strong lossy compression at a modest bitrate
// (48kbps mono is plenty for intelligible speech) without needing to hand-roll any audio codec. Kept small on
// purpose: it's saved as a Firestore document (see uploadRecording.ts), which caps documents at 1MiB.

const RECORDER_MIME = 'audio/webm;codecs=opus'
const AUDIO_BITS_PER_SECOND = 32_000

export type CallRecorder = {
  stop: () => Promise<Blob | null>
}

// Mixes the mic and AI audio into a single MediaRecorder input via a silent mixing context, rather than
// recording two separate files a responder would have to play in sync.
export function startCallRecording(micStream: MediaStream, aiStream: MediaStream): CallRecorder | null {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(RECORDER_MIME)) {
    console.warn('[QuickBite call] Recording not supported in this browser — continuing without it.')
    return null
  }

  const mixContext = new AudioContext()
  const destination = mixContext.createMediaStreamDestination()
  mixContext.createMediaStreamSource(micStream).connect(destination)
  mixContext.createMediaStreamSource(aiStream).connect(destination)

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(destination.stream, { mimeType: RECORDER_MIME, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start(1000)

  let stopped = false
  return {
    stop: () =>
      new Promise((resolve) => {
        if (stopped) return resolve(null)
        stopped = true
        recorder.onstop = () => {
          void mixContext.close()
          resolve(chunks.length ? new Blob(chunks, { type: RECORDER_MIME }) : null)
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(chunks.length ? new Blob(chunks, { type: RECORDER_MIME }) : null)
      }),
  }
}
