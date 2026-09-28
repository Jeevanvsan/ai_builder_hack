import { MIC_CONSTRAINTS } from './audio.ts'

// Same blind spot as the camera check below: a mic track can report readyState 'live' and enabled: true while
// genuinely producing silence — OS-level mute, a routing issue, or (on some phones) a second simultaneous
// getUserMedia audio request silently starving the first. Measures real RMS level via Web Audio rather than
// trusting track state. Returns true if ANY frame during the budget has a non-negligible level — a person doesn't
// need to be talking for this to pass; background room noise alone is normally enough. Only a hard-silent mic
// (line noise floor or below, held for the whole budget) fails this.
async function producesAudio(stream: MediaStream, timeoutMs = 700): Promise<boolean> {
  if (!stream.getAudioTracks().length) return false
  const ctx = new AudioContext()
  try {
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
      if (Math.sqrt(sum / data.length) > 0.003) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return false
  } finally {
    void ctx.close()
  }
}

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

// The deviceId a stream's video track actually came from, if the browser reports one.
function videoDeviceId(stream: MediaStream): string | undefined {
  return stream.getVideoTracks()[0]?.getSettings().deviceId
}

// Many Android phones silently freeze one of two simultaneous camera streams instead of failing outright — the
// track reports 'live'/enabled, the WebRTC connection reports connected, but the actual pixels never update. This
// checks for real evidence of that (two consecutive video frames compared for any pixel difference), rather than
// trusting readyState/enabled, which stay green for a genuinely dead feed. ~600ms budget: enough for a couple of
// real frames at even a slow camera's frame rate, short enough not to noticeably delay SOS startup.
async function producesFrames(stream: MediaStream, timeoutMs = 700): Promise<boolean> {
  if (!stream.getVideoTracks().length) return false
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return true // Can't check — assume fine rather than false-flag a working camera.

  const sample = (): string | null => {
    if (video.readyState < 2 || !video.videoWidth) return null
    canvas.width = 8
    canvas.height = 8
    ctx.drawImage(video, 0, 0, 8, 8)
    return ctx.getImageData(0, 0, 8, 8).data.join(',')
  }

  try {
    await video.play().catch(() => {})
    const start = Date.now()
    let first: string | null = null
    while (Date.now() - start < timeoutMs) {
      const frame = sample()
      if (frame) {
        if (first === null) first = frame
        else if (frame !== first) return true // Pixels actually changed — genuinely live.
        // Same as the first sample so far — could still be a static scene; keep sampling until the timeout.
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    // Never got a second differing frame within budget. A perfectly still scene can look identical to a frozen
    // one, so this is a heuristic, not a certainty — but a camera that never even reaches readyState 2 (no frame
    // metadata at all within 700ms) is a much stronger, unambiguous signal of a dead track.
    return first !== null
  } finally {
    video.srcObject = null
  }
}

export async function acquireSosMedia(): Promise<SosMedia> {
  let mic: MediaStream | null = null
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS })
  } catch {
    mic = null
  }
  // Unlike the camera check below, a silent mic is NEVER dropped — someone hiding or too afraid to make a sound
  // is exactly the scenario this feature exists for, and cutting the mic there would be actively harmful. This
  // only logs, as a diagnostic signal for testing (distinguishing "mic genuinely silent" from "mic never worked
  // at all" when a case shows no audio evidence) — it must never change what gets sent to the observer.
  if (mic && !(await producesAudio(mic))) {
    console.warn('[QuickBite SOS] mic opened but measured no audio level — could be a genuinely silent/hidden situation, or the mic not actually capturing; kept either way')
  }

  const cameras: SosMedia['cameras'] = []
  const back = await openCamera('environment')
  const backLive = back ? await producesFrames(back) : false
  if (back) {
    if (backLive) cameras.push({ facing: 'back', stream: back })
    else { console.warn('[QuickBite SOS] back camera opened but produced no frames — dropping it, not publishing a dead feed'); back.getTracks().forEach((t) => t.stop()) }
  }
  const front = await openCamera('user')
  // A device with only one physical camera (most laptops, some emulators) can still satisfy an 'exact:user'
  // request by loosely matching — both `back` and `front` then point at the SAME camera device, doubling every
  // frame sent to the silent observer (two samplers reading the identical feed) instead of genuinely covering two
  // angles. Confirmed a real, concrete way to overload/duplicate the Gemini Live stream on non-phone hardware.
  // Drop the duplicate rather than silently double-sampling one camera as if it were two independent feeds.
  if (front && back && videoDeviceId(front) && videoDeviceId(front) === videoDeviceId(back)) {
    front.getTracks().forEach((t) => t.stop())
  } else if (front) {
    // Requesting the back camera first, still open, can be exactly what causes a phone to silently freeze the
    // front stream (see producesFrames' doc) — check it too rather than only ever suspecting the first camera.
    if (await producesFrames(front)) cameras.push({ facing: 'front', stream: front })
    else { console.warn('[QuickBite SOS] front camera opened but produced no frames — dropping it'); front.getTracks().forEach((t) => t.stop()) }
  }

  return { mic, cameras, mode: cameras.length >= 2 ? 'dual' : 'back-only' }
}
