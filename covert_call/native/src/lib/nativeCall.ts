import type { Firestore } from 'firebase/firestore'

// Native Gemini Live wiring (Epic 12.2) — DOCUMENTED STUB, not yet implemented.
//
// The web app's src/lib/gemini/liveSession.ts already contains all the conversation logic (persona, tools,
// extraction, silence watchdog, recording). The ONLY parts that differ on React Native are the transport layers,
// which have no browser equivalent:
//
//   1. Mic PCM capture: the web uses getUserMedia + AudioContext to produce 16 kHz PCM16 chunks. On RN there is no
//      Web Audio API — capture raw PCM with a native module (e.g. @dr.pogodin/react-native-audio-api, or a
//      LiveAudioStream lib) and base64-encode 16 kHz mono frames the same way audio.ts does.
//   2. Audio playback: the model returns 24 kHz PCM16 — play it back through the same native audio library.
//   3. Camera frames (Epic 10): grab ~1 fps JPEG frames from react-native-vision-camera and send them via the
//      same session.sendRealtimeInput({ video }) call the web uses.
//   4. Live video (Epic 9/11): react-native-webrtc + registerGlobals() (already called in index.ts) lets
//      shared/video/publisher.ts run unchanged.
//
// Everything below the transport — the @google/genai Live session, the persona, the tools, and every
// shared/incidents write — is identical to the web and should be factored out and reused rather than rewritten.

export interface NativeCallHandle {
  end: () => Promise<void>
  toggleMute: () => boolean
}

export async function startNativeCall(_db: Firestore, _incidentId: string): Promise<NativeCallHandle> {
  throw new Error(
    'startNativeCall is not implemented yet (Epic 12.2). Wire native PCM capture/playback + camera frames, then ' +
      'reuse the web liveSession logic. See this file for the plan.',
  )
}
