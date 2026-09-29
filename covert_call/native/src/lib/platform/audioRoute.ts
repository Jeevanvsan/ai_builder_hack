// Routes call audio to the earpiece instead of the loudspeaker.
//
// On speakerphone everyone in the room hears Mia asking coded safety questions — including whoever the caller is
// hiding the call from. Held to the ear, only the caller hears her. So this is part of the disguise, not a
// comfort setting.
//
// First attempt used react-native-incall-manager and did nothing on a real phone. Two reasons, both worth
// recording so this isn't retried the same way:
//   1. It only calls the deprecated setSpeakerphoneOn(), which no longer overrides an explicit
//      setCommunicationDevice() on Android 12+.
//   2. The echo-cancelling audio engine claims the loudspeaker with exactly that call during its own startup,
//      which happened *after* the routing request.
// So routing now goes through this project's own native module, using the same API, and is applied after the
// audio engine is running.

type NativeRouting = {
  routeToEarpiece: () => string
  releaseAudioRouting: () => void
}

let native: NativeRouting | null | undefined

function load(): NativeRouting | null {
  if (native !== undefined) return native
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core')
    native = requireNativeModule('QbFrames') as NativeRouting
  } catch {
    console.warn('[QuickBite] audio routing unavailable in this build — call audio stays on the loudspeaker.')
    native = null
  }
  return native
}

// Applied more than once on purpose. The audio engine re-asserts its own choice whenever Android reports an
// audio device change, and those callbacks land asynchronously after startup — a single call at the wrong
// moment is silently undone, which is exactly how this failed the first time.
const REAPPLY_DELAYS_MS = [0, 400, 1500]

let timers: ReturnType<typeof setTimeout>[] = []

export function routeCallToEarpiece(): void {
  const mod = load()
  if (!mod) return

  cancelPending()
  for (const delay of REAPPLY_DELAYS_MS) {
    timers.push(
      setTimeout(() => {
        try {
          const result = mod.routeToEarpiece()
          // Logged every time: if a device still comes out of the loudspeaker, this line says whether the
          // request was refused, had nothing to route to, or was applied and then overridden again.
          console.log(`[QuickBite] audio routing -> ${result}`)
        } catch (e) {
          console.warn('[QuickBite] audio routing failed:', e)
        }
      }, delay),
    )
  }
}

export function releaseCallAudio(): void {
  cancelPending()
  const mod = load()
  if (!mod) return
  try {
    mod.releaseAudioRouting()
  } catch {
    // Nothing to release.
  }
}

function cancelPending() {
  for (const t of timers) clearTimeout(t)
  timers = []
}
