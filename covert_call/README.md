# QuickBite — AI Builder Cup 2026

**An AI that lets a person in danger ask for help when asking out loud isn't safe.**

QuickBite looks like an ordinary food-delivery app. It is actually a covert channel to an emergency response team,
built on **Gemini** + **Firebase/Cloud Run**. A person who is coerced, watched, or held uses the disguised app to
summon help without anyone nearby noticing, and a responder dashboard receives structured incident data **live**.

- **Theme:** Sustainability & Social Impact — societal impact via *resilience strengthening* and *community
  support* (see [`docs/theme-fit.md`](docs/theme-fit.md)).
- **Public name:** QuickBite. **Internal codename:** Covert Call.

## Live links
- **QuickBite app (the mandatory live deliverable):** https://quickbite-5cde0.web.app
- **Monitoring Dashboard:** https://quickbite-5cde0-dashboard.web.app

## What it does
Four ways to raise a report, one shared AI/real-time backbone:
1. **Live call** — Gemini Live plays a restaurant employee ("Mia") who asks coded menu questions and states each
   code's real meaning in the same breath. It extracts incident data live, sees the back camera (~1 fps), hears the
   background (a gunshot/shouting escalates severity), and gives the caller disguised safety advice.
2. **Silent tap** — a no-sound "delivery instructions" screen; long-press reveals meanings; attach a photo that
   Gemini reads into structured signal.
3. **Coded order ("click & order")** — coded menu items placed as an ordinary order raise a decoded incident; the
   person sees a normal "order placed" screen that mirrors the responder's progress as delivery status.
4. **Silent SOS** — double-tap the heart → a full-black "phone is off" screen that records both cameras + mic while
   a silent Gemini observer builds the incident; exit with three taps in the top-left corner.

The **dashboard** is a separate ops console: live queue with severity ranking, claim/resolve, map, voice-stress,
"seen & heard" panel, consolidated case record, live video (switchable front/back), and Drive-archived footage.

## Tech stack
- **Gemini Live API** — disguised conversation, native audio stress/tone, incremental function-calling extraction,
  camera + background-sound understanding, session resumption.
- **Gemini API (structured output)** — post-call consolidation, third-party leakage check, photo vision.
- **Firestore** — incident documents + real-time listeners (the live pipeline).
- **Firebase Hosting** — both web apps. **Cloud Run** is the deployment target for any server piece.
- **Google Maps / Geocoding** — dashboard location (free OpenStreetMap fallback when no key).
- **Free peer-to-peer WebRTC** (Firestore carries the handshake) — live video, no media server, no billing.

## Repository layout
```
covert_call/
├── web/         QuickBite web app (React + Vite) — the live-deployed disguise app
├── dashboard/   Monitoring Dashboard (React + Vite) — the responder console
├── native/      React Native (Expo) app — UNTESTED scaffold, see native/README.md
├── shared/      Code shared by all three:
│   ├── incidents/   the incident data model + write client + severity
│   ├── video/       WebRTC publisher + signaling
│   └── codes.ts     the single source of truth for coded meanings
└── docs/        plan, backlog, deck, demo script, theme fit, setup guides
```
This is an npm workspace: run `npm install` once at `covert_call/`.

## Run it locally
```bash
cd covert_call
npm install
npm run web         # QuickBite app  (Vite dev server)
npm run dashboard   # Monitoring dashboard
```
Each app needs its own `.env.local` (untracked). Copy the tracked `.env.example` in `web/` and `dashboard/` and
fill in:
- `VITE_FIREBASE_*` — Firebase web config (both apps).
- `VITE_GEMINI_LIVE_API_KEY` (web) — a Google AI Studio key for the call + text passes.
- `VITE_GEMINI_API_KEY` (dashboard) — optional, for the AI Insights tab.
- `VITE_DRIVE_UPLOAD_URL` (web) — optional, the Apps Script endpoint for Drive video
  (see [`docs/setup/drive-uploader.md`](docs/setup/drive-uploader.md)).
- `VITE_GOOGLE_MAPS_API_KEY` (dashboard) — optional; OpenStreetMap is used when unset.

**No secrets are committed** — only `.env.example` templates are tracked. Real keys live in `.env.local`.

## Deploy
```bash
npm run deploy:web         # build + firebase deploy --only hosting (default site)
npm run deploy:dashboard   # build + deploy the dashboard hosting site
```
Firestore security rules live only in `dashboard/firestore.rules` — deploy them with the dashboard, not from
another folder.

## Docs
- [`docs/quickbite_plan.md`](docs/quickbite_plan.md) — authoritative plan (feature set, data model, stack, schedule).
- [`docs/backlog.md`](docs/backlog.md) — epics → user stories → tasks, with current status.
- [`docs/deck.md`](docs/deck.md) · [`docs/demo-script.md`](docs/demo-script.md) · [`docs/theme-fit.md`](docs/theme-fit.md)
- [`docs/collaboration.md`](docs/collaboration.md) — the two-person ownership split and workflow.

## Honesty notes (for judges and future us)
- The **web app + dashboard** are the live-deployed deliverable. The **native app is an untested scaffold** — its
  Gemini audio/camera + WebRTC transport is stubbed (see `native/README.md`).
- Individual capabilities (mesh SOS, anonymisation, crash detection) exist in other products; the **novel part is
  the combination** — disguised persona + in-breath code-teaching + real-time mid-call extraction (plan §8).
- "Response" in this prototype means the dashboard incident, not integration with real emergency services.
