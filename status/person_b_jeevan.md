# Status — Person B: Jeevan

**Role:** Monitoring Dashboard + real-time incident pipeline (owns Epic 4, Epic 3, dashboard half of Epic 7; shares Epic 5 with Ameen)
**Last updated:** 2026-09-24 23:15 IST
**Live dashboard:** https://quickbite-5cde0-dashboard.web.app (Firebase project `quickbite-5cde0`, hosting site `quickbite-5cde0-dashboard`)

## Snapshot

| Epic | Status |
|---|---|
| Epic 4 — Monitoring Dashboard | ✅ Done — all 5 backlog stories + added story 4.6 (alerts), live |
| Epic 3 — Real-time pipeline | 🟡 11/14 tasks — write side built (`covert_call/shared/incidents/`); rest waits on Ameen's Gemini code and on billing |
| Epic 7.1 — Live video (dashboard side) | ✅ Done and tested with a real phone camera — sender side is Ameen's |
| Epic 5.1 — Deployment hardening (dashboard side) | 🟡 Firestore rules tightened; end-to-end pre-submission check still to do |

## Done (all 2026-09-24)

### Epic 4 — Monitoring Dashboard
- **4.1 Scaffold + live skeleton** — separate React (Vite) + TypeScript app in `covert_call/dashboard/`, deployed as a second Firebase Hosting site, light theme, large-monitor layout.
- **4.2 Live queue** — severity/status chips, live elapsed timers, 5 stat tiles; ranking: unopened incidents pinned on top, then severity → unclaimed → live calls → longest waiting; paginated (10/page, page in URL).
- **4.3 Incident detail** — map (Google Maps if a key is set, free OpenStreetMap otherwise) with approximate + confirmed pins, extracted fields that flash when they change, voice-stress meter + trend line, event timeline, live → "Case record" transition with the consolidated summary, field confidence and third-party redactions.
- **4.4 Response actions** — Acknowledge / Start response / Resolve + team notes; acknowledge is a Firestore transaction (only one responder can claim — tested with a real race); responder name set in-app (no login yet); resolving a still-live incident also ends the call.
- **4.5 Case history** — resolved cases only, search + severity/channel/handled-by/period filters kept in the URL, paginated.
- **4.6 New-incident alerts (added)** — yellow highlight until anyone opens the incident, toast, siren that repeats until someone opens it, OS notifications when the tab is in the background ("Enable alerts"), tab-title count, do-not-disturb while on an incident page, "sound is off — click anywhere" banner.

### Epic 3 — Real-time pipeline (write side)
- Real-time channel decided and built: **Firestore real-time listeners** (replaces the planned backend WebSocket/SSE).
- `shared/incidents/client.ts`: `startIncident()` (incident exists ~0.4 s after call start, before location), GPS → IP-fallback location (3 free providers), `updateLiveFields()` / `recordVoiceStress()` (severity auto-computed, never drops mid-call), `confirmAddress()` (Google geocoding if keyed, free Nominatim otherwise), `endIncident()`.
- `shared/incidents/types.ts` — the single incident data model for both apps.
- `npm run simulate-call` plays a scripted call through the exact same functions Ameen's app will use.

### Epic 7.1 — Live back-camera video (dashboard side)
- Free peer-to-peer WebRTC, Firestore carries the handshake, Google public STUN (no media server, no billing). Replaces the planned LiveKit (needs a token server → billing).
- Medium video box in the right column of the incident page + Full screen page `/incident/:id/video`; states: connecting / live / couldn't connect (retry) / feed lost / ended; sender heartbeat every 10 s.
- `shared/video/publisher.ts` — `startVideoPublisher()` for Ameen's app. Dev test sender at `/dev/camera` (not linked in the UI).

### Epic 5.1 — Hardening (dashboard side)
- Firestore rules: no deletes, only known fields with valid values, status only moves forward (resolved never reopens), ended calls never go live again, notes/stress history append-only, video handshake docs restricted. 35 allow/deny cases verified on the emulator.

### Extras / infrastructure
- Stack switched from Next.js to plain **React (Vite)** for all web apps (docs updated).
- Firestore database created in **asia-south1**; seed data (12 incidents) via `npm run seed`.
- `covert_call/` is an **npm workspace** (one install for dashboard + shared code; add `web` when Ameen's code lands).
- Credentials hygiene: repo-root `.gitignore`; Firebase config lives in `dashboard/.env.local` (untracked), `.env.example` committed.
- Decided **not** to use Supabase/Alembic (Firestore fits the nested, live-updating incident document).

## Blocked / waiting

| Item | Waiting on |
|---|---|
| 3.2 Gemini function calls → `updateLiveFields()` | Ameen's Gemini Live code in this repo |
| 3.3 persona "delivery address" → `confirmAddress()` | Ameen's Gemini Live code |
| 3.4 Post-call Gemini summary | A backend (Cloud Run/Functions) → billing on `quickbite-5cde0` (project owner) |
| Notifications with the dashboard fully closed | Firebase Cloud Messaging + server → billing |
| Google Maps (instead of OpenStreetMap) | A Maps key → billing account |

## Next up for Jeevan
- Pre-submission end-to-end check of the live link (Epic 5.1).
- Epic 5 with Ameen: demo script around the split-screen live-update moment, deck, theme-fit answer (25% of score, still undecided).
- Optional: responder sign-in (Firebase Auth is free, but a sign-in provider must be enabled in the console by the project owner) — would allow much stricter rules.

## Notes for Ameen (Person A)
- **Use the shared client, don't write incidents by hand:** `covert_call/shared/incidents/README.md` shows the 5 calls (`startIncident` → `updateLiveFields` / `recordVoiceStress` → `confirmAddress` → `endIncident`). `startIncident()` sets `viewedAt: null`, which is what makes the dashboard ring and highlight the call.
- **Video:** `covert_call/shared/video/README.md` — call `startVideoPublisher(db, incidentId, backCameraStream)`; with React Native, `react-native-webrtc` + `registerGlobals()`. Back camera only, no preview on screen.
- **Firestore rules now reject:** deletes, unknown fields, invalid values, moving a status backwards, turning an ended call live again. If a write is denied, check it against `covert_call/dashboard/firestore.rules`.
- **Please don't deploy Firestore rules from another folder** — they live in `covert_call/dashboard/firestore.rules`; deploying a different file overwrites them.
- **Please put the web app code in `covert_call/web/`** and add `"web"` to `workspaces` in `covert_call/package.json`; run `npm install` from `covert_call/`.
- Data model changes go through `covert_call/shared/incidents/types.ts` — tell Jeevan before changing it (the dashboard reads every field).
- Billing on `quickbite-5cde0` unblocks 3.4 (summary), Google Maps, and closed-tab notifications — worth deciding together with the project owner.
