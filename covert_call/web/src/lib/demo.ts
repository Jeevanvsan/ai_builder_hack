// Epic 25: hidden demo call. Long-press the QuickBite logo to start a real call that writes to the separate
// demoIncidents collection (never shown on the dashboard), ending on a "what the responder would see" card.

export const DEMO_LONG_PRESS_MS = 2_000
const LIMIT = 3
const WINDOW_MS = 60 * 60 * 1000
const KEY = 'qb.demoCalls'

// Light per-device limit so the public demo can't burn through the shared Gemini quota. Best-effort only:
// storage can be unavailable (private mode), in which case the demo is simply allowed.
function recent(): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[]
    return list.filter((t) => Date.now() - t < WINDOW_MS)
  } catch {
    return []
  }
}

export function demoCallsLeft(): number {
  return Math.max(0, LIMIT - recent().length)
}

export function recordDemoCall(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...recent(), Date.now()]))
  } catch {
    // ignore
  }
}

// Minutes until the oldest call in the window expires and a new demo is allowed.
export function minutesUntilNextDemo(): number {
  const oldest = recent()[0]
  return oldest ? Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 60_000) : 0
}
