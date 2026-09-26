import type { Incident } from '../../../shared/incidents/types'
import { channelLabel } from './format'

let audio: AudioContext | null = null
let current: { osc: OscillatorNode; gain: GainNode } | null = null
let ringTimer: ReturnType<typeof setInterval> | null = null
const RING_EVERY_MS = 4_000

function getAudio(): AudioContext | null {
  try {
    audio ??= new AudioContext()
    return audio
  } catch {
    return null // No Web Audio: visual alerts still work.
  }
}

// Browsers keep audio 'suspended' until a user gesture on the page; call this from a click/keydown handler.
export async function unlockAudio(): Promise<void> {
  try {
    await getAudio()?.resume()
  } catch {
    // Still locked (no user gesture yet).
  }
}

export const audioUnlocked = () => getAudio()?.state === 'running'

// Notifies when the browser locks/unlocks sound, so the UI can tell the responder to click.
export function onAudioStateChange(cb: (unlocked: boolean) => void): () => void {
  const ctx = getAudio()
  if (!ctx) return () => {}
  const handler = () => cb(ctx.state === 'running')
  ctx.addEventListener('statechange', handler)
  return () => ctx.removeEventListener('statechange', handler)
}

// Emergency-siren style 'wail': pitch sweeps 650 Hz -> 1450 Hz and back, three cycles (~3 s).
// A sawtooth through a low-pass filter gives the siren's edge without being piercing.
export function playAlertSound(): void {
  try {
    const ctx = getAudio()
    // While locked, scheduling would queue sirens that all fire at once on unlock; skip instead.
    if (!ctx || ctx.state !== 'running') return
    const t0 = ctx.currentTime + 0.05
    const cycle = 1.0
    const cycles = 3
    const end = t0 + cycle * cycles

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2200
    const gain = ctx.createGain()

    osc.frequency.setValueAtTime(650, t0)
    for (let n = 0; n < cycles; n++) {
      const c = t0 + n * cycle
      osc.frequency.linearRampToValueAtTime(1450, c + cycle * 0.5)
      osc.frequency.linearRampToValueAtTime(650, c + cycle)
    }

    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.08)
    gain.gain.setValueAtTime(0.22, end - 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    osc.connect(filter).connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(end + 0.05)
    current = { osc, gain }
  } catch {
    // Audio blocked or unavailable.
  }
}

// Repeats the wail until stopRinging(); used while any incident is still unopened.
export function startRinging(): void {
  if (ringTimer !== null) return
  playAlertSound()
  ringTimer = setInterval(playAlertSound, RING_EVERY_MS)
}

export function stopRinging(): void {
  if (ringTimer !== null) {
    clearInterval(ringTimer)
    ringTimer = null
  }
  if (current) {
    try {
      current.gain.gain.cancelScheduledValues(0)
      current.gain.gain.value = 0
      current.osc.stop()
    } catch {
      // Already stopped.
    }
    current = null
  }
}

// Epic 16.7: a distinct, one-shot cue for when severity escalates on an incident a responder already has open —
// deliberately different from playAlertSound()'s siren wail (that one means "unopened incident"), so the two are
// never confused. Two quick high beeps rather than a sweep.
export function playEscalationCue(): void {
  try {
    const ctx = getAudio()
    if (!ctx || ctx.state !== 'running') return
    const t0 = ctx.currentTime + 0.02
    for (const start of [0, 0.18]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 1100
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t0 + start)
      gain.gain.exponentialRampToValueAtTime(0.28, t0 + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.14)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + start)
      osc.stop(t0 + start + 0.16)
    }
  } catch {
    // Audio blocked or unavailable.
  }
}

export const notificationsSupported = () => typeof Notification !== 'undefined'

// System notification for when the dashboard tab is in the background or another window has focus.
export function showSystemNotification(incident: Incident, onOpen: () => void): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  const n = new Notification(`New incident ${incident.id}`, {
    body: `${channelLabel(incident.channel)} just started. Open the dashboard to respond.`,
    tag: incident.id,
    requireInteraction: true,
  })
  n.onclick = () => {
    window.focus()
    onOpen()
    n.close()
  }
}
