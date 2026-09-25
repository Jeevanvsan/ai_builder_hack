# QuickBite native app (Epic 12) — UNTESTED SCAFFOLD

React Native (Expo) port of the QuickBite disguise app. **This scaffold was written without an Expo toolchain or a
device to build/run it, so treat it as a starting point, not a working build.** The pure-UI + incident-writing
parts (Home, Cart, Checkout coded-order, Silent tap, Settings) are ported and use the shared incident client, which
runs under the Firebase JS SDK on React Native. The audio/video pipeline is stubbed with clear pointers.

## What's wired
- Navigation (React Navigation native-stack) and the disguise screens.
- Home → the two forks (Call / Silent tap) + **heart double-tap → silent SOS** (Epic 11.1).
- Checkout **coded order → decoded incident** via the shared `decodeOrder()` + incident client (Epic 8).
- Silent tap report (Epic 1.3) writing through the shared client.
- Silent SOS screen: black overlay, keep-awake, incident creation, secret three-tap exit (Epic 11).
- **Disguise personalisation** (Epic 13): name + icon presets, persisted with AsyncStorage, loaded before first render.

## What's NOT wired yet (needs native modules + a device)
- **Gemini Live audio** (mic PCM capture + playback): see `src/lib/nativeCall.ts`. No Web Audio API on RN — use a
  native PCM lib. All conversation logic already exists in the web `liveSession.ts` and should be reused.
- **Camera frames to Gemini** and **live video** (Epics 9–11): `react-native-webrtc` (globals registered in
  `index.ts`) drives `shared/video/publisher.ts`; grab ~1 fps frames with `react-native-vision-camera`.
- **Drive recording** on native (`react-native-webrtc` has no MediaRecorder — spike a native recorder).
- **Alternate home-screen icons** (Epic 13): wire `setIcon()` in `src/lib/appearance.tsx` to a config-plugin lib
  (e.g. `expo-alternate-app-icons`) once icon assets exist; configure it in `app.json`.

## Run it (on your machine)
1. `npm install` at the `covert_call/` root (native is a workspace).
2. `cd native && npx expo install --fix` to align every native module to the installed Expo SDK.
3. Set env vars in `native/.env` (Expo uses the `EXPO_PUBLIC_` prefix, not `VITE_`):
   - `EXPO_PUBLIC_FIREBASE_*` — copy the web app's Firebase values.
   - the Gemini key, for the call.
   - `EXPO_PUBLIC_DRIVE_UPLOAD_URL` — same Apps Script URL as the web's `VITE_DRIVE_UPLOAD_URL`, **once native video
     recording is implemented** (it's stubbed today, so nothing reads it yet). See `docs/setup/drive-uploader.md`.
4. Build a **dev client** (not Expo Go — WebRTC / PCM / alternate icons need native code): `npx expo run:android`.

## Shared code
Imports `../shared/incidents/*`, `../shared/video/*` and `../shared/codes` directly — the same source of truth as
the web app and dashboard. Do not fork these; fix them in `shared/`.
