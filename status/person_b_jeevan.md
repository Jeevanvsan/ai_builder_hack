# Status — Person B: Jeevan

**Role:** Monitoring Dashboard + real-time incident pipeline (owns Epic 4, Epic 3, dashboard half of Epic 7; shares Epic 5 with Ameen)
**Last updated:** 2026-09-25 15:40 IST — Branch `ep-5-dashboard-auth`: Firebase Auth sign-in, a Responder Management page (add/edit/disable/remove), a full incident Analytics page and a Responder Performance page (both with ECharts visuals — maps, trends, gauges, scatter), and an AI Insights tab on Analytics that has Gemini turn the incident stats into Immediate actions / Recommendations / Suggestions, auto-refreshed once a day. All live and tested end-to-end.
**Live dashboard:** https://quickbite-5cde0-dashboard.web.app (Firebase project `quickbite-5cde0`, hosting site `quickbite-5cde0-dashboard`)

## Snapshot

| Epic | Status |
|---|---|
| Epic 4 — Monitoring Dashboard | ✅ Done — all 5 backlog stories + added story 4.6 (alerts), live |
| Epic 3 — Real-time pipeline | 🟡 11/14 tasks — write side built (`covert_call/shared/incidents/`); rest waits on Ameen's Gemini code and on billing |
| Epic 7.1 — Live video (dashboard side) | ✅ Done and tested with a real phone camera — sender side is Ameen's |
| Epic 5.1 — Deployment hardening (dashboard side) | ✅ Firestore rules tightened + auth-gated; end-to-end pre-submission check done |
| Dashboard sign-in (added) | ✅ Firebase Auth (Email/Password) live, replaces the honor-system name prompt |
| Responder management (added) | ✅ Admin-only page: add/edit/disable/remove responders |
| Analytics + AI Insights (added) | ✅ Incident analytics page (charts, map, hotspot tables) + Gemini-generated action insights, auto-refreshed daily |
| Responder performance (added) | ✅ Admin-only page: per-responder KPIs, workload, speed-vs-volume, resolution rate |

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
- Pre-submission end-to-end check done directly on the live URL (not just localhost): fresh load, full incident lifecycle, direct-URL loads of `/incident/:id` and `/history`, pagination/filters, alerts — all confirmed working.

### Dashboard sign-in (2026-09-25, branch `ep-5-dashboard-auth`)
- Firebase Auth (Email/Password) replaces the old free-text "who's on shift" name prompt. Two responder accounts created in the console (`jeevan@quickbite.com`, `ameen@quickbite.com`).
- Sign-in screen gates the whole dashboard (`RequireAuth` wraps all routes except `/dev/camera`); acknowledge/resolve/notes/viewed now record the signed-in user's email (local part shown, e.g. "jeevan"), not a free-typed name.
- Firestore rules updated: any write that changes `response.status`, `response.notes`, `response.acknowledgedBy`, or `response.viewedAt` now requires `request.auth != null`. The QuickBite app's own writes (create, live extraction fields, call state) stay unauthenticated since callers never sign in — only responder actions are gated.
- Debugged a real sign-in 403: the dashboard's Firebase API key had an HTTP-referrer restriction in Google Cloud that didn't include the dashboard's own domain — fixed by removing the referrer restriction on that key (it's a public client config key, security is enforced by Firestore rules + Auth, not by hiding it).
- Deployed live: rules (`deploy:rules`) and hosting (`deploy`) both pushed.

### Responder management (2026-09-25, same branch)
- New `responders` Firestore collection, keyed by email (not UID — avoids needing Admin SDK to look up a new person's UID). Shape: `{ name, email, role: admin|responder, status: active|disabled, createdAt, createdBy }`.
- The two founding admins (`jeevan@quickbite.com`, `ameen@quickbite.com`) self-provision as admins on first sign-in (Firestore rule `isBootstrapAdmin`); every other responder must be added by an existing admin first.
- `/admin/responders` page (admin-only, `RequireAdmin` guard): add / edit (name, role) / disable-enable / remove. Adding a responder here does **not** create their Firebase Auth login — the admin still creates that separately in the console (the page's "Add responder" success screen links straight to it and repeats the exact email to use).
- Sign-in enforcement: after Firebase Auth succeeds, the app looks up `responders/{email}`; if missing or `status: disabled`, it force-signs the user out with a message. A real account with no roster entry, or a disabled one, can't use the dashboard even though the Firebase Auth login itself would succeed.
- Nav restructured: top-level nav moved out of the cramped top-right corner into its own full-width row (`Live queue | Case history | Analytics | Responder management | Responder performance`), with the two admin items only rendered for admins.

### Analytics + Responder Performance pages (2026-09-25, same branch)
- **`/analytics`** (all responders): KPI strip, incident-locations map (Leaflet, auto-fits zoom to every point), incidents-over-time line, severity donut, time-of-day polar chart, day-of-week radar, channel donut, people-count bar, voice-stress gauges by severity, danger-indicator ranking, plus two drill-down tables (top confirmed addresses, ~500m hotspot grid cells) — each with incident count, avg severity, most common danger indicator.
- **`/admin/performance`** (admin-only): per-responder KPI strip, acknowledged-vs-resolved bar, workload-share donut, speed-vs-volume bubble scatter, severity-workload stacked bar, response-speed horizontal bar (outlier-capped on the chart, exact minutes still in the tooltip/table), resolution-rate gauges per responder, full detail table.
- Chart library switched from Recharts to **Apache ECharts** (`echarts` + `echarts-for-react`) partway through for the animated/gradient look — chart type deliberately varied per metric (line for trend, donut for composition, polar/radar for cyclical time patterns, scatter for a two-variable tradeoff, gauge for a single %, bar only where it's genuinely a category comparison), not bar-charts-by-default.
- Fixed two real bugs found via screenshots: donut labels overlapping their own legend (turned off the outer label ring, kept the legend), and the radar/polar charts rendering as tiny circles in over-sized empty cards (fixed with correct 2-column row sizing instead of stretching a circular chart across a full-width card).

### AI Insights (2026-09-25, same branch) — Gemini on the Analytics page
- New "AI Insights" sub-tab next to "Charts" on `/analytics`. Sends the page's already-aggregated stats (no raw incident/personal data) to Gemini as a compact key=value prompt, asks for three sections: **Immediate actions**, **Recommendations**, **Suggestions** — scoped explicitly to incident patterns (hotspots, timing, danger indicators, open-case risk), not responder staffing.
- Model: **`gemini-3.5-flash-lite`** (cheapest current text model — `gemini-2.5-flash-lite` was retired for new API keys mid-session, `gemini-2.5-flash` also considered but heavier than needed for a short summarization task).
- Shared cache in Firestore (`analytics/aiInsights`, readable by any signed-in responder, writable by any signed-in responder) — best-effort once-a-day auto-refresh: whoever's browser first loads `/analytics` after the cache turns 24h+ old silently triggers a background regenerate (no click needed), and a manual "Refresh" button is always available. True server-side daily cron would need a scheduled Cloud Function, which needs Firebase's Blaze plan — skipped to avoid billing, per standing project constraint.
- `VITE_GEMINI_API_KEY` in `dashboard/.env.local` (gitignored), documented in `.env.example`. If unset, the tab still shows but says AI Insights isn't set up rather than exposing the env var name in the UI.

### Extras / infrastructure
- Stack switched from Next.js to plain **React (Vite)** for all web apps (docs updated).
- Firestore database created in **asia-south1**; seed data (12 incidents) via `npm run seed`.
- `covert_call/` is an **npm workspace** (one install for dashboard + shared code; add `web` when Ameen's code lands).
- Credentials hygiene: repo-root `.gitignore`; Firebase config lives in `dashboard/.env.local` (untracked), `.env.example` committed.
- Decided **not** to use Supabase/Alembic (Firestore fits the nested, live-updating incident document).

## Blocked / waiting

| Item | Waiting on |
|---|---|
| 3.2 Gemini function calls → `updateLiveFields()` | Ameen's Gemini Live call flow (Story 1.2). Web app is in the repo since PR #3, but `CallPage` is still a placeholder |
| 3.3 persona "delivery address" → `confirmAddress()` | Same, Story 1.2 |
| 3.4 Post-call Gemini summary | A backend (Cloud Run/Functions) → billing on `quickbite-5cde0` (project owner) |
| Notifications with the dashboard fully closed | Firebase Cloud Messaging + server → billing |
| Google Maps (instead of OpenStreetMap) | A Maps key → billing account |

## Next up for Jeevan
- Raise a PR for `ep-5-dashboard-auth` → `main` (now includes auth, responder management, analytics, responder performance, and AI Insights — a bigger PR than usual, worth flagging to Ameen before he reviews).
- Epic 5 with Ameen: demo script around the split-screen live-update moment, deck, theme-fit answer (25% of score, still undecided).

## Notes for Ameen (Person A)
- **Dashboard now needs sign-in:** the live dashboard at https://quickbite-5cde0-dashboard.web.app requires a login. Your account is `ameen@quickbite.com` — ask Jeevan for the password, or reset it yourself from the Firebase console (Authentication → Users). This doesn't affect the QuickBite app's own Firestore writes at all — no login needed on your side, only the dashboard changed.
- **You're a founding admin:** the first time you sign in, you automatically get admin rights (roster entry created for you). Admin unlocks two extra pages: Responder management (add/edit/disable other responders) and Responder performance.
- **AI Insights needs a Gemini API key:** if you want to test/regenerate it yourself, add your own `VITE_GEMINI_API_KEY` to `covert_call/dashboard/.env.local` (free key from Google AI Studio) and rebuild — otherwise it just shows "not set up" and doesn't break anything else.
- **Use the shared client, don't write incidents by hand:** `covert_call/shared/incidents/README.md` shows the 5 calls (`startIncident` → `updateLiveFields` / `recordVoiceStress` → `confirmAddress` → `endIncident`). `startIncident()` sets `viewedAt: null`, which is what makes the dashboard ring and highlight the call.
- **Video:** `covert_call/shared/video/README.md` — call `startVideoPublisher(db, incidentId, backCameraStream)`; with React Native, `react-native-webrtc` + `registerGlobals()`. Back camera only, no preview on screen.
- **Firestore rules now reject:** deletes, unknown fields, invalid values, moving a status backwards, turning an ended call live again. If a write is denied, check it against `covert_call/dashboard/firestore.rules`.
- **Please don't deploy Firestore rules from another folder** — they live in `covert_call/dashboard/firestore.rules`; deploying a different file overwrites them.
- **Please put the web app code in `covert_call/web/`** and add `"web"` to `workspaces` in `covert_call/package.json`; run `npm install` from `covert_call/`.
- Data model changes go through `covert_call/shared/incidents/types.ts` — tell Jeevan before changing it (the dashboard reads every field).
- Billing on `quickbite-5cde0` unblocks 3.4 (summary), Google Maps, and closed-tab notifications — worth deciding together with the project owner.
