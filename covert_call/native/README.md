# QuickBite native app (Epic 12)

React Native (Expo SDK 53) port of the QuickBite disguise app. It writes to the **same Firestore** as the web app,
so the responder dashboard treats a phone-raised incident exactly like a browser-raised one.

**Status: feature-complete except the camera, and not yet run on a device.** It typechecks and Metro bundles it,
but no EAS build has been made since the port, so treat every "works" below as "built and verified as far as is
possible without hardware".

## What's built
- **Disguise UI**, matching `../web` screen for screen: all 22 menu items with images, search, category chips,
  promo banner, item sheet with the 500 ms coded-item reveal, bill details, cart, checkout (address, payment,
  delivery speed), order-placed with live status mirroring.
- **Hidden SOS trigger** — heart double-tap within 400 ms, no visual feedback.
- **Live Gemini call** — persona conversation, tool calls straight into `shared/incidents`, live transcript,
  silence watchdog, reconnection, post-call consolidation + privacy check + correlation, call recording uploaded
  to Drive.
- **Silent SOS** — immediate high-severity incident, silent observer (audio), three-tap-anywhere exit, Android
  back blocked, status bar hidden, brightness dropped and restored.
- **Delivery instructions** — press-and-hold reveal, multi-select urgency, address, note, photo attach analysed
  by Gemini.
- **Coded order** — decoded into an incident at checkout, with the order-placed screen mirroring responder
  progress as delivery milestones.
- **Disguise personalisation** — in-app name + icon presets, persisted (the OS-level icon swap is still a stub).

## What's NOT built
- **Cameras.** No live video to the dashboard, no ~1 fps frames to Gemini, no video recording. WebRTC holds the
  camera for the live feed and React Native has no canvas to sample it from, so this needs a small native frame
  source. Until then the SOS is audio-only.
- **Listen-in audio** (the responder listening to the caller's raw mic) is written but disabled in `src/lib/config.ts`
  until it's confirmed that Android allows a second concurrent capture of the same mic without starving the
  Gemini feed.
- **OS home-screen icon switching** (`src/lib/appearance.tsx`).

## How the code is organised
- `src/lib/gemini/` — ported from `../web/src/lib/gemini/`. Each file names the web file it mirrors in its header.
  **If you change one of these on the web, change it here too** (the root `CLAUDE.md` parity rule).
- **Imported from the web unchanged, not copied:** `web/src/lib/gemini/persona.ts`, `web/src/lib/gemini/tools.ts`,
  `web/src/lib/nav/liveTracking.ts`. The persona changes often; a copy would drift. Moving or renaming any of
  those three breaks this build.
- `src/lib/platform/` — the things with no browser equivalent: microphone/playback and a `navigator.geolocation`
  shim backed by `expo-location`.
- `../shared/` — incidents, codes, routing, geocoding. Used unchanged by web, native and the dashboard.

## Two switches worth knowing about
Both live in `src/lib/config.ts` and are JS-only, so flipping either needs a reload, not a new build.

- `AUDIO_BACKEND` — `'audio-api'` (default) keeps background sounds audible to Gemini as evidence, matching the
  web's deliberate choice to turn noise suppression off, but does **not** engage the phone's echo canceller.
  `'two-way'` engages it but forces noise suppression on with it. **Switch to `'two-way'` if Mia interrupts
  herself on a real phone** — the give-away is her own words appearing in the transcript as the caller.
- `LISTEN_IN_ENABLED` — off, see above.

## Recording format
The web records compact Opus via MediaRecorder. React Native has no encoder available, so the caller's mic and
Mia's replies are mixed in JS and written as **WAV** (`src/lib/gemini/recorder.ts`) — roughly **1.9 MB/min**.
Fine for Drive; it overruns the ~1 MB Firestore fallback after about 30 seconds, so that fallback realistically
only covers very short calls. It fails loudly and writes the reason to the incident rather than truncating.

## Setup

```bash
cd covert_call && npm install     # native is a workspace member
```

Create `native/.env.local` with the **same values as the web app's** `VITE_*`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GEMINI_LIVE_API_KEY=...
EXPO_PUBLIC_DRIVE_UPLOAD_URL=...
# EXPO_PUBLIC_ENABLE_GROUNDED_CONTEXT=true   # optional, off by default
```

Cloud builds do **not** read that file — push the values to EAS once per environment:

```bash
npx eas-cli login
npx eas-cli env:push --environment preview --path .env.local
npx eas-cli env:push --environment development --path .env.local
```

## Running it

**Expo Go will not work** — WebRTC, native audio and the Gemini call all need a real build.

```bash
# One-off: a dev client you install once, then iterate over Metro in seconds
npx eas-cli build -p android --profile development
npm run start          # scan the QR from the dev client app

# A standalone APK to hand to a tester
npm run build:preview  # = eas build -p android --profile preview
```

Both print a QR code when finished; scan it on the phone to install (allow "install from unknown sources").
EAS Update is configured, so **JS-only fixes ship with `eas update` instead of another build** — only native
module changes need a rebuild.

## Checks to run before a build
```bash
npx tsc --noEmit                 # types
npx expo-doctor                  # dependency/config sanity
npx expo export -p android       # proves Metro resolves and bundles everything
```
That last one is worth the 30 seconds: it has already caught two problems that would otherwise have cost a
~1 hour cloud build each.

## Before demoing: grant permissions once
The first time the app needs the mic, camera or location, Android shows its permission dialog — including on the
SOS screen, where it appears over the black overlay and undercuts the "phone is off" illusion. This is
unavoidable for any app, so **run one call and one SOS on the device before a demo or a judged run**, accept
everything, and every later trigger is silent.

## Fastest way to see it working
Open the dashboard (https://quickbite-5cde0-dashboard.web.app) beside the phone and watch incidents land:
- **Coded order** — add a coded item (e.g. Extra Pepperoni) → Checkout → Place order.
- **Delivery instructions** — Home → Delivery instructions → pick options + address → Save.
- **Silent SOS** — double-tap the heart → black screen; three taps anywhere exits.
- **Live call** — Home → Call to order (cart must be empty).
