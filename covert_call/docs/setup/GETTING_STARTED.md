# Getting Started with QuickBite

QuickBite has no separate backend server. The apps talk to **Firestore** (real-time listeners) and **Gemini**
directly, and Google Apps Script handles Drive uploads and email. For the full picture see
[../architecture/](../architecture/README.md).

## What's in `covert_call/`

| Folder | What it is | Dev command (from `covert_call/`) |
|---|---|---|
| `web/` | QuickBite, the disguised caller app (React + Vite) | `npm run web` |
| `dashboard/` | Responder dashboard (React + Vite) | `npm run dashboard` |
| `landing/` | Public website, user manual and judges' tour | `npm run landing` |
| `native/` | React Native (Expo) Android port of the web app | `npm run native` |
| `shared/` | Incident data model, Firestore write client, severity, routing, video | (imported by the apps) |
| `eval/` | Scripted Gemini Live test calls and the cost/performance report | see its `README.md` |

It is one npm workspace, so install once:

```bash
cd covert_call
npm install
```

## Configuration

Each app reads its own `.env.local` (git-ignored). Copy the tracked `.env.example` in `web/` and `dashboard/`
and fill in:

- `VITE_FIREBASE_*`: the Firebase web config (both apps).
- `VITE_GEMINI_LIVE_API_KEY` (web): a Google AI Studio key for the live call and the text passes.
- `VITE_GEMINI_API_KEY` (dashboard, optional): for AI Insights and Ask AI.
- `VITE_DRIVE_UPLOAD_URL` (web, optional): the Apps Script endpoint, see [drive-uploader.md](drive-uploader.md).
- `VITE_GOOGLE_MAPS_API_KEY` (dashboard, optional): OpenStreetMap/Leaflet is used when unset.

- `VITE_TRUSTED_ALERT_URL` (web, optional): trusted-contact and case-report emails, a second Apps Script, see
  [trusted-alert.md](trusted-alert.md).

## Run it

```bash
npm run dashboard   # sign in with a responder account
npm run web         # open on a phone or another tab, allow the microphone
```

Then tap **Call to order** in the web app and watch the incident appear on the dashboard and fill in live.
To see the dashboard react without making a real call:

```bash
npm run simulate-call
```

### Without a Firebase project (local emulator)

```bash
cd dashboard
npm run emulator          # Firestore emulator
npm run dev:emulator      # dashboard against the emulator
npm run seed:emulator     # sample incidents
```

## Deploy (Firebase Hosting)

```bash
npm run deploy:web
npm run deploy:dashboard
npm run deploy:landing
npm run deploy:rules -w dashboard   # Firestore rules live only in dashboard/firestore.rules
```
