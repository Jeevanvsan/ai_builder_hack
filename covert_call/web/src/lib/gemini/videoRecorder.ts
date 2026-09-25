// Records a call's back-camera video (with the call audio) into one compact file for the team's Drive archive
// (Epic 9.2). Separate from recorder.ts, which saves audio-only to Firestore — this keeps the fuller video
// evidence, which is too big for a Firestore document, headed for Google Drive instead (see videoUpload.ts).

const MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
  'video/mp4',
]
const VIDEO_BITS_PER_SECOND = 800_000

export type VideoRecorderHandle = {
  mimeType: string
  // The recording so far, as a complete blob — uploaded periodically during the call so a tab killed mid-call
  // still leaves footage in Drive (Epic 9.2). Null until the first chunk is flushed.
  snapshot: () => Blob | null
  stop: () => Promise<Blob | null>
}

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

// Records the given stream (expected to carry a video track plus an audio track). Returns null when recording
// isn't supported, so the call proceeds without an archived video.
export function startVideoRecording(stream: MediaStream): VideoRecorderHandle | null {
  const mimeType = pickMime()
  if (!mimeType || stream.getVideoTracks().length === 0) return null

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  // Timeslice so data is flushed periodically rather than only at stop — less lost if the recorder is torn down.
  recorder.start(5000)

  let stopped = false
  return {
    mimeType,
    snapshot: () => (chunks.length ? new Blob(chunks, { type: mimeType }) : null),
    stop: () =>
      new Promise((resolve) => {
        if (stopped) return resolve(null)
        stopped = true
        recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null)
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null)
      }),
  }
}
