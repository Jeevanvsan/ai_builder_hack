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

## How to test it (on your machine)

You need Node, and either **Android Studio** (an emulator) or a physical device with USB debugging. You must build
a **dev client** — Expo Go won't work because of `react-native-webrtc`.

```bash
# 1. Install the workspace (native is a workspace member)
cd covert_call && npm install

# 2. Reconcile every Expo/native module to the SDK, and add the WebRTC config plugin app.json needs.
cd native
npx expo install --fix
npx expo install @config-plugins/react-native-webrtc

# 3. Create native/.env (Expo uses the EXPO_PUBLIC_ prefix, NOT VITE_):
#    EXPO_PUBLIC_FIREBASE_API_KEY=...        (copy the web app's Firebase values)
#    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
#    EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
#    EXPO_PUBLIC_FIREBASE_APP_ID=...
#    (EXPO_PUBLIC_DRIVE_UPLOAD_URL — only once native recording exists; nothing reads it yet)

# 4. Generate native projects and run a dev build on a device/emulator:
npx expo run:android      # or: npx expo run:ios   (macOS + Xcode)
```

### Fastest way to see it actually working
The native app writes to the **same Firestore** as the web app, so open the live dashboard
(https://quickbite-5cde0-dashboard.web.app) on the side and watch it react. These paths already work end-to-end
(no native AV needed):
- **Coded order:** add a coded item (e.g. Extra Pepperoni) → Checkout → Place order → a `click-order` incident
  appears on the dashboard.
- **Silent tap:** Home → Delivery instructions → pick options + address → Save → a `silent-tap` incident appears.
- **Silent SOS:** double-tap the heart → black screen; a `silent-sos` / hostage incident appears; three taps
  top-left exits.

### What will NOT work yet (stubbed)
- The **live call** and the **SOS observer** create the incident and the UI, but there's **no Gemini audio/video**
  — native PCM capture/playback + camera frames aren't implemented (see `src/lib/nativeCall.ts`). So no persona
  conversation, no live video feed, no Drive recording on native.
- **Alternate home-screen icon** switching (name changes work in-app; the OS icon swap is stubbed).

### Known setup gaps to expect (I couldn't build this here)
- `app.json` references `@config-plugins/react-native-webrtc` — that's why step 2 installs it before `run:android`.
- Firestore live listeners on RN sometimes need `experimentalForceLongPolling` (see `src/lib/firebase.ts`).
- Versions in `package.json` are indicative; `npx expo install --fix` is what makes them coherent for your SDK.

## Shared code
Imports `../shared/incidents/*`, `../shared/video/*` and `../shared/codes` directly — the same source of truth as
the web app and dashboard. Do not fork these; fix them in `shared/`.
