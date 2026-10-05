import type { MotionKind } from '../../../shared/incidents/types.ts'

// Epic 30: motion alerts from the phone's accelerometer, so a responder knows why a call went quiet. Simple
// thresholds on acceleration magnitude (in g), no ML:
//   snatched: a sharp jerk (> 2.8 g) with a big change in how the phone is held, while it wasn't already moving fast
//   fall:     a free-fall dip (< 0.35 g for 120 ms+) followed by an impact (> 2.5 g) within a second
//   running:  a steady 2.3-3.6 Hz bounce with strong swings, held for 6 s
//   still:    after moving or a snatch/fall, almost no movement for 20 s (phone dropped, hidden, or caller frozen)
// Each kind reports at most once per cooldown, so one struggle doesn't flood the incident.

const G = 9.81
const COOLDOWN_MS: Record<MotionKind, number> = { snatched: 20_000, fall: 20_000, running: 45_000, still: 60_000 }

export type MotionWatch = { stop: () => void }

// iOS Safari only gives motion data after a permission prompt, and the prompt must come from a tap. Call this from
// the tap that starts the call or SOS; elsewhere (Android, desktop) it resolves straight away.
export async function requestMotionPermission(): Promise<boolean> {
  const req = (globalThis.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission
  if (!req) return typeof DeviceMotionEvent !== 'undefined'
  try {
    return (await req()) === 'granted'
  } catch {
    return false
  }
}

export function watchMotion(onEvent: (kind: MotionKind, peakG: number) => void): MotionWatch {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return { stop: () => {} }

  const last: Partial<Record<MotionKind, number>> = {}
  const emit = (kind: MotionKind, peak: number) => {
    const t = Date.now()
    if (t - (last[kind] ?? 0) < COOLDOWN_MS[kind]) return
    last[kind] = t
    onEvent(kind, Math.round(peak * 10) / 10)
  }

  // Rolling 6 s window of (time, magnitude in g) and the gravity direction, for orientation change.
  const win: { t: number; g: number }[] = []
  let gravity: [number, number, number] | null = null
  let freeFallSince = 0
  let freeFallEndedAt = 0
  let lastActiveAt = Date.now()
  let wasActive = false

  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const t = Date.now()
    const g = Math.hypot(a.x, a.y, a.z) / G
    win.push({ t, g })
    while (win.length && t - win[0].t > 6000) win.shift()

    // Slow-moving gravity estimate; the angle between it and the current reading shows the phone being turned.
    const v: [number, number, number] = [a.x, a.y, a.z]
    const prev = gravity
    gravity = prev ? [prev[0] * 0.9 + v[0] * 0.1, prev[1] * 0.9 + v[1] * 0.1, prev[2] * 0.9 + v[2] * 0.1] : v
    const turned = prev ? angle(prev, v) : 0

    // Fall: free fall, then an impact soon after.
    if (g < 0.35) { if (!freeFallSince) freeFallSince = t } else if (freeFallSince) {
      if (t - freeFallSince >= 120) freeFallEndedAt = t
      freeFallSince = 0
    }
    if (g > 2.5 && freeFallEndedAt && t - freeFallEndedAt < 1000) { emit('fall', g); freeFallEndedAt = 0; wasActive = true }

    // Running: steady rhythm of strong peaks.
    const running = isRunning(win)
    if (running) emit('running', Math.max(...win.map((w) => w.g)))

    // Snatch: a sharp jerk plus a large turn, and not just part of a running stride.
    if (g > 2.8 && turned > 50 && !running) { emit('snatched', g); wasActive = true }

    // Still: after real movement, the phone lies almost motionless.
    const swing = win.length > 10 ? Math.max(...win.map((w) => w.g)) - Math.min(...win.map((w) => w.g)) : 1
    if (swing > 0.25) { lastActiveAt = t; if (running) wasActive = true }
    else if (wasActive && t - lastActiveAt > 20_000) { emit('still', g); wasActive = false }
  }

  window.addEventListener('devicemotion', onMotion)
  return { stop: () => window.removeEventListener('devicemotion', onMotion) }
}

function angle(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const m = Math.hypot(...a) * Math.hypot(...b)
  return m ? (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI : 0
}

// Counts strong peaks (> 1.6 g, at least 250 ms apart) over the window: 14+ peaks in ~6 s is 2.3+ steps a second,
// faster than walking; very regular gaps rule out shaking.
function isRunning(win: { t: number; g: number }[]): boolean {
  if (win.length < 60 || win[win.length - 1].t - win[0].t < 5500) return false
  const peaks: number[] = []
  for (let i = 1; i < win.length - 1; i++) {
    if (win[i].g > 1.6 && win[i].g >= win[i - 1].g && win[i].g >= win[i + 1].g && (!peaks.length || win[i].t - peaks[peaks.length - 1] > 250)) peaks.push(win[i].t)
  }
  if (peaks.length < 14 || peaks.length > 22) return false
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i])
  const mean = gaps.reduce((s, x) => s + x, 0) / gaps.length
  const sd = Math.sqrt(gaps.reduce((s, x) => s + (x - mean) ** 2, 0) / gaps.length)
  return sd / mean < 0.35
}
