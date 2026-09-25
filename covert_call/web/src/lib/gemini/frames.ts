// Samples the back-camera stream to a JPEG about once a second and hands each frame to Gemini Live as realtime
// video input (Epic 10.1). Gemini Live's video is frame-by-frame (~1 fps), not true continuous video, so this is
// exactly how the model expects to receive it. No frame is ever shown on the caller's screen.

const DEFAULT_FPS = 1
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
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  const capture = () => {
    if (stopped || !ctx || video.readyState < 2 || !video.videoWidth) return
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    onFrame(dataUrl.slice(dataUrl.indexOf(',') + 1))
  }

  void video.play().then(() => {
    if (stopped) return
    timer = setInterval(capture, Math.max(250, Math.round(1000 / fps)))
  }).catch(() => {
    // If the hidden video can't autoplay, frames just won't be sent; audio-only analysis still works.
  })

  return {
    stop: () => {
      stopped = true
      if (timer) clearInterval(timer)
      video.srcObject = null
    },
  }
}
