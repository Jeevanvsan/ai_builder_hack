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

// Applied exactly once, and deliberately so. An earlier version re-applied at 0/400/1500 ms to outlast the audio
// engine's own device callbacks — but switching the output device repeatedly while the echo canceller is still
// converging defeated the canceller entirely, and Mia's greeting came back through the mic and into the
// transcript as the caller. The canceller calibrates against the device that is live when recording starts, so
// the fix is to settle routing before that point (see startMicTwoWay) and then leave it alone.
export function routeCallToEarpiece(): void {
  const mod = load()
  if (!mod) return
  try {
    const result = mod.routeToEarpiece()
    // Worth logging every call: "still on speaker" has several causes, and this distinguishes a refusal from a
    // device with no earpiece from a module that never loaded.
    console.log(`[QuickBite] audio routing -> ${result}`)
  } catch (e) {
    console.warn('[QuickBite] audio routing failed:', e)
  }
}

export function releaseCallAudio(): void {
  const mod = load()
  if (!mod) return
  try {
    mod.releaseAudioRouting()
  } catch {
    // Nothing to release.
  }
}
