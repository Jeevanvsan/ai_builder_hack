// JS wrapper for the qb-frames native module.
//
// Gemini Live takes video as periodic stills (~1 fps, each tokenised separately) rather than a continuous
// stream, so this hands it exactly that: a still taken from the camera WebRTC is already streaming to the
// responder. No second camera is opened — Android generally won't allow one — and the live feed is untouched.
//
// Everything here degrades to "no frames" rather than throwing, so a build without the native module (or a
// device where the effect can't be installed) still runs the call and the SOS, just without Gemini seeing.

const PROCESSOR_NAME = 'qb-frames'

type NativeQbFrames = {
  configure: (intervalMs: number, maxWidth: number, quality: number) => void
  grabJpeg: () => string | null
  reset: () => void
}

let native: NativeQbFrames | null | undefined

function load(): NativeQbFrames | null {
  if (native !== undefined) return native
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core')
    native = requireNativeModule('QbFrames') as NativeQbFrames
  } catch {
    console.warn('[QuickBite] qb-frames native module unavailable — Gemini will not receive camera frames.')
    native = null
  }
  return native
}

export type FrameSource = {
  // The newest still as base64 JPEG, or null when nothing new has been captured since the last call.
  grab: () => string | null
  stop: () => void
}

// Installs the tap on a live video track. Returns null when frames aren't available, so callers can carry on
// audio-only without special-casing anything.
export function startFrameTap(stream: { getVideoTracks: () => unknown[] } | null): FrameSource | null {
  const mod = load()
  if (!mod || !stream) return null

  const track = stream.getVideoTracks()[0] as { _setVideoEffect?: (name: string) => void } | undefined
  if (!track?._setVideoEffect) return null

  try {
    mod.reset()
    mod.configure(900, 640, 60)
    track._setVideoEffect(PROCESSOR_NAME)
  } catch (e) {
    console.warn('[QuickBite] could not install the frame tap:', e)
    return null
  }

  return {
    grab: () => {
      try {
        return mod.grabJpeg()
      } catch {
        return null
      }
    },
    stop: () => {
      try {
        // Removes the processor; the track keeps streaming to the responder either way.
        track._setVideoEffect?.('')
        mod.reset()
      } catch {
        // Nothing to undo.
      }
    },
  }
}
