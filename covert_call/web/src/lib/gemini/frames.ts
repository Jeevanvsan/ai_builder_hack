// Samples the back-camera stream to a JPEG every couple of seconds and hands each frame to Gemini Live as realtime
// video input (Epic 10.1). Gemini Live's video is frame-by-frame (~1 fps), not true continuous video, so this is
// exactly how the model expects to receive it. No frame is ever shown on the caller's screen.

// One still every 2 s. Each frame is ~258 tokens and stays in the context, so 1 fps made video the biggest cost
// of a call; a weapon, a plate or a fire is still seen within a couple of seconds.
export const FRAMES_PER_SECOND = 0.5
const DEFAULT_FPS = FRAMES_PER_SECOND
const JPEG_QUALITY = 0.6
// Downscale so each frame is a modest payload; detail beyond this adds tokens without helping recognition much.
const MAX_WIDTH = 640

export interface FrameSampler {
  stop: () => void
}

// Draws frames from `stream` and calls `onFrame` with base64 JPEG data (no data-URI prefix). Returns a stop fn.
export function startFrameSampler(
  stream: MediaStream,
  onFrame: (base64Jpeg: string) => void,
  fps = DEFAULT_FPS,
): FrameSampler {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream(stream.getVideoTracks())
  // Phone browsers don't render frames into a <video> that isn't in the page (readyState stays < 2), so the
  // sampler never captured anything and Mia never saw the camera. Keep it in the page, invisibly.
  video.setAttribute('playsinline', '')
  video.setAttribute('aria-hidden', 'true')
  Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' })
  document.body.appendChild(video)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  let sent = 0
  const capture = () => {
    if (!stopped && video.paused) void video.play().catch(() => {})
    if (stopped || !ctx || video.readyState < 2 || !video.videoWidth) return
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    onFrame(dataUrl.slice(dataUrl.indexOf(',') + 1))
    if (++sent === 1) console.info('[QuickBite] camera frames are reaching Gemini')
  }

  // The timer runs whether or not the first play() succeeds: a refused autoplay used to mean no frames for the
  // whole call, silently. capture() retries play() and skips until a real frame is available.
  void video.play().catch(() => {})
  timer = setInterval(capture, Math.max(250, Math.round(1000 / fps)))

  return {
    stop: () => {
      stopped = true
      if (timer) clearInterval(timer)
      video.srcObject = null
      video.remove()
    },
  }
}
