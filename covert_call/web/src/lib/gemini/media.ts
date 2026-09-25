import { MIC_CONSTRAINTS } from './audio.ts'

// Opens the mic and the back camera in a single getUserMedia so the call has one audio track (for Gemini + the
// recording) and one video track (for the live dashboard feed + the Drive recording), behind one OS
// camera/mic indicator (Epic 9). Falls back to audio-only if the camera is unavailable or denied, so a call can
// still happen without video. Returns null only if even the mic can't be opened.
export interface CallMedia {
  stream: MediaStream
  hasVideo: boolean
}

export async function acquireCallMedia(): Promise<CallMedia | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: MIC_CONSTRAINTS,
      video: { facingMode: { ideal: 'environment' } },
    })
    return { stream, hasVideo: stream.getVideoTracks().length > 0 }
  } catch {
    // Camera denied/unavailable — retry audio-only so the call still connects.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS })
      return { stream, hasVideo: false }
    } catch {
      return null
    }
  }
}

// A video-only view of a combined stream, for the WebRTC publisher (which adds every track it's given, and we
// don't want the mic going to the dashboard).
export const videoOnly = (stream: MediaStream) => new MediaStream(stream.getVideoTracks())
