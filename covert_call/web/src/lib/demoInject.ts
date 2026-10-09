declare const __DEMO_V__: string
import { keepAudioRunning } from './gemini/audio'
import { watchGpsSim } from './gpsSim'
import { DEFAULT_SCENARIO, SCENARIOS, startAiCaller, type AiCallerHandle } from './aiCaller'
// Demo feed injection (for recording the demo video): a REAL call from this phone, but the camera picture and/or a
// background sound can be switched to a prepared clip while it runs, from a laptop script (eval/demo.ts) or the
// dashboard. Everything downstream (Mia's camera frames, the dashboard's live video, listen-in, the recordings)
// gets the injected feed, because it replaces the camera and mic tracks at the source.
//
// Available on every call (see readFlag): nothing changes until a responder sends a command, so normal calls
// behave exactly as before.
// Clips live in web/public/demo/ (video/<name>.mp4, sound/<name>.mp3), credits in public/demo/CREDITS.md.
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'

const FLAG = 'qb-demo-inject'
// On for every call, so the demo video can show the real app opened normally (no special link on the phone).
// Without a command the camera and mic pass straight through; only a signed-in responder can send one (Firestore
// rule on demoControl). A device can opt out with ?demoInject=0 (remembered; ?demoInject=1 opts back in).
function readFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('demoInject')
    if (q === '0') localStorage.setItem(FLAG, 'off')
    else if (q !== null) localStorage.removeItem(FLAG)
    return localStorage.getItem(FLAG) !== 'off'
  } catch {
    return true
  }
}
export const demoInjectEnabled = typeof window !== 'undefined' && readFlag()

export const DEMO_CONTROL = 'demoControl'
// video + videoAt: start a clip (videoAt changes = start again); loopVideo false = play once, then back to the real
// camera. sound + soundAt: play a sound (loopSound to repeat).
export type DemoControl = import('./gpsSim').GpsSimControl & { aiCallerAt?: number; aiCallerOn?: boolean; aiScenario?: string; aiVoice?: string; aiMuteMic?: boolean; video?: string | null; videoAt?: number; loopVideo?: boolean; sound?: string | null; soundAt?: number; loopSound?: boolean }

// The canvas matches the real camera (capped at 1280 px wide, 24 fps), so a normal call looks the same as before.
const MAX_W = 1280
const MAX_FPS = 24

// One injector per page: the call/SOS media are wrapped once, then driven by the control doc.
let videoState: { canvas: HTMLCanvasElement; real: HTMLVideoElement | null; clip: HTMLVideoElement | null; timer: number } | null = null
let audioState: { ctx: AudioContext; out: MediaStreamAudioDestinationNode; playing: AudioBufferSourceNode | null; micGain: GainNode } | null = null
const soundCache = new Map<string, Promise<AudioBuffer>>()

// Phone browsers pause (or never decode past the first frame of) a <video> that isn't in the page, so the clip
// showed as a still image and Mia got the same frozen frame every time. Players are kept in the page, invisibly.
function mountHidden(v: HTMLVideoElement) {
  v.setAttribute('playsinline', '')
  v.setAttribute('aria-hidden', 'true')
  Object.assign(v.style, { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' })
  document.body.appendChild(v)
}

// Stopping a wrapped track must also stop the real camera/mic under it: the call stops the tracks it was given,
// and without this the real camera stayed on (its light lit) after the call ended.
function linkStop(wrapped: MediaStreamTrack, real: MediaStreamTrack | undefined, cleanup: () => void) {
  const stop = wrapped.stop.bind(wrapped)
  wrapped.stop = () => {
    stop()
    real?.stop()
    cleanup()
  }
  return wrapped
}

// Camera track → a canvas track that shows the real camera, or the clip while one is set.
function wrapVideo(stream: MediaStream): MediaStreamTrack | null {
  const realTrack = stream.getVideoTracks()[0]
  const set = realTrack?.getSettings() ?? {}
  const scale = Math.min(1, MAX_W / (set.width || 640))
  const WIDTH = Math.round((set.width || 640) * scale)
  const HEIGHT = Math.round((set.height || 480) * scale)
  const FPS = Math.min(MAX_FPS, set.frameRate || 15)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let real: HTMLVideoElement | null = null
  if (realTrack) {
    real = document.createElement('video')
    real.muted = true
    real.playsInline = true
    real.srcObject = new MediaStream([realTrack])
    mountHidden(real)
    void real.play().catch(() => {})
  }
  let drewOnce = false
  const draw = () => {
    // Keep both players running: a browser can still pause a hidden one (e.g. after the tab was backgrounded).
    const clipNow = videoState?.clip
    if (clipNow && clipNow.paused && !clipNow.ended) void clipNow.play().catch(() => {})
    if (real && real.paused) void real.play().catch(() => {})
    const src = videoState?.clip ?? real
    if (src && src.readyState >= 2 && src.videoWidth) {
      // Cover the canvas like a phone camera would (crop, don't letterbox).
      const s = Math.max(WIDTH / src.videoWidth, HEIGHT / src.videoHeight)
      const w = src.videoWidth * s
      const h = src.videoHeight * s
      ctx.drawImage(src, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h)
      drewOnce = true
    } else if (!drewOnce) {
      // While a clip buffers (start, loop) the last frame stays up instead of flashing black.
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
    }
  }
  // setInterval, not requestAnimationFrame: rAF stops when the screen is dimmed (the SOS black screen).
  const timer = window.setInterval(draw, 1000 / FPS)
  videoState = { canvas, real, clip: null, timer }
  const track = canvas.captureStream(FPS).getVideoTracks()[0]
  if (!track) return null
  return linkStop(track, realTrack, () => {
    window.clearInterval(timer)
    if (videoState?.timer === timer) { videoState.clip?.pause(); videoState.clip?.remove(); videoState.real?.remove(); videoState = null }
  })
}

// Mic track → the real mic mixed with any injected sound (the sound goes into the call, not out of the speaker).
function wrapAudio(stream: MediaStream): MediaStreamTrack | null {
  const micTrack = stream.getAudioTracks()[0]
  if (!micTrack) return null
  const ctx = new AudioContext()
  // Phones can create an AudioContext 'suspended' when it isn't started from a tap; then the mixed mic track
  // carries silence/stutter to Gemini. Resume now and on the next touch, just in case.
  const stopResume = keepAudioRunning(ctx)
  const out = ctx.createMediaStreamDestination()
  // The real mic goes through a gain so the AI caller can replace it (gain 0) without touching the call.
  const micGain = ctx.createGain()
  ctx.createMediaStreamSource(new MediaStream([micTrack])).connect(micGain)
  micGain.connect(out)
  audioState = { ctx, out, playing: null, micGain }
  const track = out.stream.getAudioTracks()[0]
  if (!track) return null
  return linkStop(track, micTrack, () => {
    if (audioState?.ctx === ctx) { audioState.playing?.stop(); audioState = null }
    stopResume()
    void ctx.close().catch(() => {})
  })
}

// Returns the stream to use instead of `stream` (same shape: its audio and video tracks swapped for injectable
// ones). Without the demo flag it returns `stream` untouched.
export function injectable(stream: MediaStream): MediaStream {
  if (!demoInjectEnabled) return stream
  const tracks: MediaStreamTrack[] = []
  const a = stream.getAudioTracks().length ? wrapAudio(stream) : null
  if (a) tracks.push(a)
  else tracks.push(...stream.getAudioTracks())
  const v = videoState ? null : wrapVideo(stream)
  if (v) tracks.push(v)
  else tracks.push(...stream.getVideoTracks())
  return new MediaStream(tracks)
}

// Wraps an SOS camera stream (video only) the same way; only the first one is injectable.
export const injectableCamera = (stream: MediaStream) => (demoInjectEnabled && !videoState ? new MediaStream([wrapVideo(stream) ?? stream.getVideoTracks()[0]]) : stream)
export const injectableMic = (stream: MediaStream) => (demoInjectEnabled && !audioState ? new MediaStream([wrapAudio(stream) ?? stream.getAudioTracks()[0]]) : stream)

function setVideo(name: string | null | undefined, loop = true) {
  if (!videoState) return
  if (!name) {
    videoState.clip?.pause()
    videoState.clip?.remove()
    videoState.clip = null
    return
  }
  const clip = document.createElement('video')
  clip.src = `/demo/video/${name}.mp4?v=${__DEMO_V__}`
  clip.muted = true
  clip.loop = loop
  // Played once: when it ends, the call shows the real camera again.
  clip.onended = () => { if (videoState?.clip === clip) { videoState.clip = null; clip.remove() } }
  clip.playsInline = true
  clip.crossOrigin = 'anonymous'
  mountHidden(clip)
  void clip.play().catch(() => {})
  const old = videoState.clip
  old?.pause()
  old?.remove()
  videoState.clip = clip
}

async function playSound(name: string | null | undefined, loop = false) {
  if (!audioState) return
  audioState.playing?.stop()
  audioState.playing = null
  if (!name) return
  const { ctx, out } = audioState
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
  if (!soundCache.has(name)) {
    soundCache.set(name, fetch(`/demo/sound/${name}.mp3?v=${__DEMO_V__}`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)))
  }
  const buffer = await soundCache.get(name)!.catch(() => null)
  if (!buffer || !audioState) return
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = loop
  src.connect(out)
  src.start()
  audioState.playing = src
}

// Mia's voice, handed over by the live call so the AI caller can hear her directly (demo recording only).
let miaAudio: MediaStream | null = null
// Fully automatic demo: open the app once with ?aiCaller=1 (chase) or ?aiCaller=domestic (remembered until
// ?aiCaller=0) and every call on that phone starts the AI caller as soon as Mia's line opens.
const AUTO_KEY = 'qb-ai-caller'
const aiCallerAuto = (() => {
  try {
    const q = new URLSearchParams(location.search).get('aiCaller')
    if (q === '0') localStorage.removeItem(AUTO_KEY)
    else if (q) localStorage.setItem(AUTO_KEY, SCENARIOS[q] ? q : 'chase')
    const v = localStorage.getItem(AUTO_KEY)
    return v ? (SCENARIOS[v] ? v : 'chase') : null
  } catch { return null }
})()
export const setMiaAudio = (s: MediaStream | null) => {
  miaAudio = s
  if (s && aiCallerAuto && demoInjectEnabled) setTimeout(() => { if (!aiCaller) void applyAiCaller({ aiCallerOn: true, aiScenario: SCENARIOS[aiCallerAuto].text }) }, 300)
}
let aiCaller: AiCallerHandle | null = null
function stopAiCaller() {
  aiCaller?.stop()
  aiCaller = null
  if (audioState) audioState.micGain.gain.value = 1
}
async function applyAiCaller(c: DemoControl) {
  stopAiCaller()
  if (!c.aiCallerOn) return
  if (!audioState || !miaAudio) { console.warn('[QuickBite demo] AI caller: the call is not ready yet'); return }
  if (c.aiMuteMic !== false) audioState.micGain.gain.value = 0
  try {
    aiCaller = await startAiCaller({ ctx: audioState.ctx, out: audioState.out, speaker: audioState.ctx.destination, mia: miaAudio, scenario: c.aiScenario || DEFAULT_SCENARIO, voice: c.aiVoice || 'Aoede' })
  } catch (e) {
    console.warn('[QuickBite demo] AI caller could not start', e)
    audioState.micGain.gain.value = 1
  }
}

// Listens for the laptop's commands for this incident (demoControl/{incidentId}). Returns an unsubscribe.
let unwatch: (() => void) | null = null
export function watchDemoControl(db: Firestore, incidentId: string): void {
  if (!demoInjectEnabled) return
  unwatch?.()
  const stopGps = watchGpsSim(db, incidentId, DEMO_CONTROL)
  let lastSoundAt = 0
  let lastAiAt = Date.now() - 5_000
  // Only a press after this call started counts (a leftover trigger from an earlier call never fires).
  let lastChase = Date.now() - 5_000
  let lastVideoKey: string | undefined
  unwatch = onSnapshot(doc(db, DEMO_CONTROL, incidentId), { includeMetadataChanges: false }, (snap) => {
    // Only real server state may change the clip. When Firestore's connection drops and recovers (the "Listen
    // stream transport errored" warnings), the listener can get a cached or missing document: read as "no video",
    // that switched the call to the real camera for a moment and then restarted the clip.
    if (snap.metadata.fromCache || !snap.exists()) return
    const c = (snap.data() ?? {}) as DemoControl
    if ((c.chaseAt ?? 0) > lastChase) { lastChase = c.chaseAt!; window.dispatchEvent(new Event('qb-demo-chase')) }
    if ((c.aiCallerAt ?? 0) > lastAiAt) { lastAiAt = c.aiCallerAt!; void applyAiCaller(c) }
    const videoKey = `${c.video ?? ''}|${c.videoAt ?? 0}`
    if (videoKey !== lastVideoKey) { lastVideoKey = videoKey; setVideo(c.video, c.loopVideo ?? true) }
    // A sound is a one-shot trigger: replayed whenever soundAt changes (same clip twice = two gunshots).
    if ((c.soundAt ?? 0) !== lastSoundAt) { lastSoundAt = c.soundAt ?? 0; void playSound(c.sound, c.loopSound) }
  }, () => {})
  const stopControl = unwatch
  unwatch = () => { stopControl?.(); stopGps() }
}

export function stopDemoInject() {
  stopAiCaller()
  unwatch?.()
  unwatch = null
  if (videoState) {
    window.clearInterval(videoState.timer); videoState.clip?.pause(); videoState.clip?.remove()
    ;(videoState.real?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
    videoState.real?.remove(); videoState = null
  }
  if (audioState) { audioState.playing?.stop(); void audioState.ctx.close().catch(() => {}); audioState = null }
}
