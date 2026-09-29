// Every environment value the native app reads, in one place. The web reads these through
// `import.meta.env.VITE_*`, which Babel does NOT transform for React Native — on native they come from
// `process.env.EXPO_PUBLIC_*` instead, inlined by Expo at build time. Values are copied from the web app's
// own .env (same Firebase project, same Gemini key, same Drive endpoint).
//
// Cloud builds do NOT read native/.env.local — push the same values to EAS once with:
//   npx eas-cli env:push --environment preview --path .env.local

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_LIVE_API_KEY ?? ''

export const DRIVE_UPLOAD_URL = process.env.EXPO_PUBLIC_DRIVE_UPLOAD_URL
export const driveConfigured = Boolean(DRIVE_UPLOAD_URL)

// Same default as the web: off unless explicitly enabled, so an ended call doesn't add a third request to the
// shared free-tier text-model quota.
export const GROUNDED_CONTEXT_ENABLED = process.env.EXPO_PUBLIC_ENABLE_GROUNDED_CONTEXT === 'true'

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

// ---------------------------------------------------------------------------------------------------------
// Device-dependent switches. Both audio backends are compiled into the same build on purpose: swapping one for
// the other is a JS change, not another hour-long EAS build.
// ---------------------------------------------------------------------------------------------------------

// Which microphone/playback backend the call uses.
//   'audio-api'  — react-native-audio-api. Web Audio-shaped, so it mirrors web/src/lib/gemini/audio.ts almost
//                  exactly, and it does NOT apply noise suppression, so background sounds still reach Gemini as
//                  evidence (the web deliberately turns noise suppression off for the same reason). It does not
//                  engage the phone's echo canceller, so Mia's voice coming out of the loudspeaker can leak back
//                  into the mic.
//   'two-way'    — @speechmatics/expo-two-way-audio. Records through the phone's VOICE_COMMUNICATION path with
//                  the hardware echo canceller on, which fixes leakage — but it forces noise suppression on at
//                  the same time (no separate switch), so quiet background evidence is partly lost.
// Set to 'two-way' after the first real device test. On 'audio-api' the loudspeaker fed straight back into the
// mic: Mia's own greeting was transcribed as the CALLER, Gemini treated it as her being interrupted, and she
// restarted the greeting again and again — which also made her speech sound broken up, because it was being cut
// off mid-sentence each time. Losing some background-sound evidence to noise suppression is a far smaller price
// than a call that can't hold a sentence. Revisit only if a device shows the opposite problem.
export const AUDIO_BACKEND: 'audio-api' | 'two-way' = 'two-way'

// Publishes the caller's raw mic to the dashboard so a responder can listen in live, as the web does. Off until
// checked on a device: Android may refuse a second concurrent capture of the same mic, and if it does, the loser
// is silent — which could be the Gemini feed. Not worth risking the call itself for the listen-in channel.
export const LISTEN_IN_ENABLED = false
