// Routes call audio to the earpiece instead of the loudspeaker.
//
// This matters more here than in an ordinary app. On speakerphone, everyone in the room hears Mia asking coded
// safety questions — including whoever the caller is hiding the call from. Held to the ear like any normal phone
// call, only the caller hears her. The disguise depends on it.
//
// Neither audio backend can do this from JavaScript: react-native-audio-api's session options are iOS-only, and
// the two-way engine's own Kotlin explicitly selects the built-in speaker and re-asserts that choice whenever
// audio devices change. So routing is handled by react-native-incall-manager, which owns Android's AudioManager
// for the duration of a call — exactly what it exists for.
//
// The require is guarded because a native module that isn't in the installed APK throws on import. That keeps a
// dev client built before this was added working (routing simply stays on speaker) instead of crashing at launch,
// so this can ship over the air and then start working after the next build.

type InCallManager = {
  start: (opts?: { media?: 'audio' | 'video'; auto?: boolean; ringback?: string }) => void
  stop: (opts?: { busytone?: string }) => void
  setForceSpeakerphoneOn: (flag: boolean) => void
  setSpeakerphoneOn: (enable: boolean) => void
}

let manager: InCallManager | null | undefined

function load(): InCallManager | null {
  if (manager !== undefined) return manager
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-incall-manager')
    manager = (mod?.default ?? mod) as InCallManager
  } catch {
    console.warn('[QuickBite] in-call audio routing unavailable in this build — audio stays on the loudspeaker.')
    manager = null
  }
  return manager
}

// Called as a call starts. `false` here means "do not force speakerphone", which routes to the earpiece; a
// headset or Bluetooth device, if connected, still wins, which is the behaviour a caller would expect.
export function routeCallToEarpiece(): void {
  const m = load()
  if (!m) return
  try {
    m.start({ media: 'audio', auto: false })
    m.setForceSpeakerphoneOn(false)
    m.setSpeakerphoneOn(false)
  } catch (e) {
    console.warn('[QuickBite] could not route call audio to the earpiece:', e)
  }
}

// Hands Android's audio focus back. Skipping this leaves the phone in call mode afterwards, which quietly
// changes how every other app's audio behaves.
export function releaseCallAudio(): void {
  const m = load()
  if (!m) return
  try {
    m.stop()
  } catch {
    // Nothing to release.
  }
}
