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

// Acquires the mic and BOTH cameras for the silent SOS (Epic 11.2). Tries the back camera first, then the front;
// many phones/browsers refuse two simultaneous camera streams, in which case we fall back to back-only. The web
// build doesn't attempt time-sliced alternating between cameras — that's the native app's job (Epic 12).
export interface SosMedia {
  mic: MediaStream | null
  cameras: { facing: 'back' | 'front'; stream: MediaStream }[]
  mode: 'dual' | 'back-only'
}

async function openCamera(facing: 'environment' | 'user'): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } })
  } catch {
    // Some devices don't support `exact` facingMode; retry as a preference (mostly matters on laptops).
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
    } catch {
      return null
    }
  }
}

export async function acquireSosMedia(): Promise<SosMedia> {
  let mic: MediaStream | null = null
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS })
  } catch {
    mic = null
  }

  const cameras: SosMedia['cameras'] = []
  const back = await openCamera('environment')
  if (back) cameras.push({ facing: 'back', stream: back })
  const front = await openCamera('user')
  if (front) cameras.push({ facing: 'front', stream: front })

  return { mic, cameras, mode: cameras.length >= 2 ? 'dual' : 'back-only' }
}
