# QuickBite Backlog — Epics, User Stories, Sub-tasks

Derived from `docs/quickbite_plan.md` (authoritative plan — refer there for full rationale on any item). Ordered roughly by build sequence (Week 1 → Week 4 → stretch goals), not by epic number.

**Legend**: 🔴 Core (non-negotiable) · 🟡 Strong (second AI layer / dashboard) · 🟢 Stretch (only if time remains)

**Status (2026-09-25):** Epic 4 done and live at https://quickbite-5cde0-dashboard.web.app. Epics 1, 2 and 3 are now built end-to-end on branch `epic-1-2-3-gemini-live` (picked up by Jeevan while Ameen was busy — not yet merged, pending Ameen's review): the disguised Gemini Live call flow, silent-tap mode, structured extraction, voice stress, leakage check, and post-call consolidation (built client-side, not blocked on backend billing as originally scoped). Deployed live to https://quickbite-5cde0.web.app. Remaining open items in Epic 1/2: the "call ever mistakes itself for a literal food order" rehearsal check, and further live-call rehearsal of the persona's investigative depth. Epic 7.1 dashboard side done and tested with the dev camera (free P2P video); the real sender needs Person A's native app. Epics 5 and 6 not started.

**Phase 2 (2026-09-25, merged to `main` via PR #8):** Epics 8–14 built — click-and-order, live call video + Google Drive storage, vision- and sound-aware call, heart double-tap silent SOS, native app foundation (untested, no device/toolchain in the build env), icon/name personalisation (native only), and dashboard support. See each epic below for exact per-story status; several stories are marked `[~]` (partially done) or still need a live device/manual rehearsal test.

**Phase 3 (planned 2026-09-26):** Epics 15–19 added at the end of this file, drawn from `covert_call/docs/extended_feature_brainstorm.md` (a 911-transcript-driven brainstorm, itself sourced from `docs/extended_video_transcripts.md`). Covers responder-facing UX/GenAI depth (reasoning trace, confidence dial, dispatch-bulletin formatting, annotated live transcript, live-redrawing scene sketch, replay scrubber, cross-incident correlation, nearby-services lookup) and persona/call-flow refinements (presence-filling chatter, guess-and-confirm fallback, dropped-call handling, bystander-live-event code). None started yet — sizing/priority against the remaining time budget still needs a decision before work begins. The brainstorm doc's explicitly-rejected "deep search a named person" idea is not included anywhere in Phase 3.

---

## EPIC 1 — QuickBite Disguise (Core Mechanism) 🔴

*The person-facing app. Must be indistinguishable from an ordinary food-delivery app at every point.*

### User Story 1.1

**As a person in danger, I want the app to look and behave exactly like a normal food-delivery app, so that anyone watching me sees nothing unusual.**

- [x] Build disguised home screen: menu, cart, checkout flow, branded as an ordinary delivery app (visual polish is high-priority — disguise realism is the entire premise)
- [x] Ensure home screen is the single fork point: only two exits — "Call to order" and ordinary checkout — never a sequence where tapping leads into calling
- [x] QA pass: does any screen, at any point, visually suggest this is a safety app?

### User Story 1.2

**As a person who can safely talk, I want to tap one button and have a real, adaptive phone conversation, so that I can convey an emergency without saying anything overtly.**

- [x] Integrate Gemini Live API over WebSocket (web app first) — `web/src/lib/gemini/liveSession.ts`, model `gemini-3.8-live`
- [x] Design and write the restaurant-employee persona's system instructions — `web/src/lib/gemini/persona.ts`, rewritten as a multi-round options-only investigator after live-call testing
- [x] Build the live-call UI screen (call timer, mute/end controls — looks like a real call) — `web/src/pages/CallPage.tsx`
- [x] Write the full set of coded questions the persona can ask (people count, danger indicators, urgency, address) — 13 disguised scenario codes plus a fixed drill-down set (headcount, weapon type, clothing, vehicle, colour, movement, injury, recurrence)
- [x] **Hard gate, not optional**: for every coded question, verify the real meaning is stated in the same spoken sentence — verified in `persona.ts`'s RULE 1; every option states its meaning inline, no exceptions
- [x] Test: does the persona ever mistake the disguised call for a literal food order? — explicit "never a literal food order" instruction plus live phone-call rehearsal; no regression observed

### User Story 1.3

**As a person who cannot safely make sound or has no connectivity, I want a silent way to submit a report by tapping, so that the app still works when talking isn't possible.**

- [x] Build silent tap-only checkout screen — no call button present anywhere on this path — `web/src/pages/SilentTapPage.tsx`, forked from Home via `BottomBar.tsx`, never from the call flow
- [x] Implement long-press-to-reveal tooltips on each tappable element (styled like a normal app hint)
- [x] Add free-text "note for the rider" field as a flexible input alongside fixed tap options
- [x] Wire "Place order" to silently submit the tap-based report through the same backend pipeline as live-call mode — writes directly via `updateLiveFields`/`confirmAddress`, no Gen AI needed for this path

### User Story 1.4

**As a person who needs to abandon the app quickly, I want an instant, untraceable way to exit, so that nothing on screen reveals I was ever using it for this purpose.**

- [x] Implement the universal zero-trace exit gesture — `web/src/lib/gemini/exit.ts`'s `zeroTraceExit()`, shared by both the live-call End button and silent-tap Submit
- [x] Verify: "report sent" and "backed out" states are visually identical — no confirmation dialog, no visible difference
- [x] Verify: exit is instant, no animation/delay that could be noticed — plain `navigate('/', { replace: true })`

### User Story 1.5

**As a developer, I want structured incident data extracted from both interaction modes, so that the backend and dashboard receive consistent, usable fields regardless of which mode was used.**

- [x] Implement Gemini structured extraction (function calling) from live-call transcript — `web/src/lib/gemini/tools.ts`'s `report_situation`/`confirm_address`, called incrementally, merged not overwritten in `shared/incidents/client.ts`'s `updateLiveFields()`
- [x] Implement structured extraction from silent-tap selections + free text — `SilentTapPage.tsx`, plain app logic
- [x] Define and validate the shared extracted-fields shape (peopleCount, dangerIndicators, urgency, notes) used by both modes — `Incident['extractedFieldsLive']` in `shared/incidents/types.ts`

---

## EPIC 2 — Second AI Reasoning Layer 🟡

*Closes the technical-merit gap — a single extraction step reads as "one feature," not "a system."*

### User Story 2.1

**As a responder, I want to know how distressed the caller sounds, not just what they said, so that I can gauge urgency even from tone alone.**

- [x] Wire Gemini Live's native audio analysis (pitch/pace/tone) into the same Live API call already used for conversation — persona reports `report_stress_level` roughly every 15-20s
- [x] Map stress output into a `voiceStressScore` + `voiceStressTrend` time series — `recordVoiceStress()` in `shared/incidents/client.ts`
- [x] Feed voice stress into the incident's urgency/severity calculation — `deriveSeverity()` in `shared/incidents/severity.ts`

### User Story 2.2

**As a system, I want to check every extracted report for accidental exposure of uninvolved third parties before it reaches a responder, so that people mentioned in the call (a bystander, a child) aren't put at risk without cause.**

- [x] Design the second Gemini pass ("leakage check") — reviews extracted report content, not metadata — `web/src/lib/gemini/leakageCheck.ts`, client-side text call, same pattern as the dashboard's AI Insights
- [x] Define what counts as a flaggable third-party mention vs. acceptable content
- [x] Wire leakage-check output (`leakageCheckStatus: { reviewed, redactions }`) into the incident record before it's shown to a responder — `recordLeakageCheck()` in `shared/incidents/client.ts`, run on call end alongside consolidation

---

## EPIC 3 — Real-Time Incident Pipeline 🔴

*The single strongest demo moment: the dashboard updates live, starting at call-start, not call-end.*

### User Story 3.1

**As a responder, I want to see a new incident the instant someone starts a QuickBite session, so that I'm already watching before any details are even known.**

- [x] Backend: create incident document in Firestore the moment a session starts (`callState: "active"`), not when the call ends — `startIncident()` in `shared/incidents/client.ts`; QuickBite app needs to call it
- [x] Establish real-time channel between backend and dashboard — decided: Firestore real-time listeners (dashboard subscribes to `incidents` directly; backend only writes to Firestore). Dashboard side built in Story 4.3
- [x] Push a "new incident" event to the dashboard at session start, before any fields are extracted — the incident is written before location capture, so it appears within ~1s

### User Story 3.2

**As a responder, I want to watch incident fields populate live while the call is still happening, so that I don't have to wait for the call to end before I can start acting.**

- [x] Wire incremental Gemini Live function-calling to emit partial extraction results mid-call, not just at the end — call `updateLiveFields()` / `recordVoiceStress()` from `shared/incidents/client.ts`; writes are queued sequentially per-incident to avoid Firestore transaction races between rapid back-to-back tool calls
- [x] Stream each field update to the backend, then broadcast over the real-time channel to all subscribed dashboard clients — `updateLiveFields()` / `recordVoiceStress()`
- [x] Build dashboard-side live-updating incident card UI (field-by-field reveal, not a static reload)

### User Story 3.3

**As a responder, I want to see the incident's rough location the instant it's created, then a precise address once it's confirmed, so that I have something actionable immediately and better information soon after.**

- [x] Capture device GPS/browser geolocation instantly at session start (plain device API, no AI)
- [x] Attach rough location to the incident document; render an approximate pin on the dashboard immediately
- [x] Add IP-based location fallback for devices without GPS (laptop/PC) — three free providers tried in order
- [x] Wire the live-call persona's "delivery address" coded question to refine location into a confirmed address — `confirmAddress()` called from `confirm_address` tool calls; address is spelled back and pin code confirmed digit-by-digit for reliable geocoding
- [x] Integrate Google Maps JavaScript API (dashboard pin) and Geocoding API (coordinates → readable address) — Google when a key is set, free OpenStreetMap map + Nominatim geocoding otherwise

### User Story 3.4

**As a responder reviewing a case after the fact, I want one coherent written summary instead of a pile of raw fields, so that I can understand what happened without reconstructing it myself.**

- [x] Design the post-call consolidation prompt: full transcript + extracted fields + voice-stress trend + leakage-check result → one incident summary — `web/src/lib/gemini/consolidate.ts`; unblocked by moving this client-side instead of waiting on backend billing
- [x] Trigger consolidation pass when `callState` flips to `"ended"` — runs in `CallPage.tsx`'s `finishCall()`, alongside leakage check
- [x] Write `consolidatedSummary` and `fieldConfidence` (confirmed/inferred/uncertain per field) to the incident record, replacing the live working state as the permanent record — `consolidateIncident()` in `shared/incidents/client.ts`

---

## EPIC 4 — Monitoring Dashboard (Separate App, Response Team) 🟡

*Its own deployment, not a phone-sized panel — this is the mandatory live-clickable deliverable.*

### User Story 4.1

**As a response team, I want our own dedicated application, so that we have a real operations tool, not a scaled-down view of the disguise app.**

- [x] Scaffold the Monitoring Dashboard as its own repo/app — do not fold into the QuickBite frontend project
- [x] Deploy a skeleton version live on Cloud Run/Firebase on day 1-2 (mandatory deliverable — de-risk early) — live at https://quickbite-5cde0-dashboard.web.app
- [x] Design for a large monitor/operations-center display, not phone-first

### User Story 4.2

**As a responder, I want a queue of all active incidents ranked by severity, so that I can see at a glance which case needs attention first.**

- [x] Build multi-case queue view: severity chips, status chips, time-elapsed/time-ago — live from Firestore, paginated (10 per page, page kept in the URL)
- [x] Implement severity sorting/ranking logic — incidents nobody has opened yet are pinned on top (newest first), then severity, unclaimed, live calls, longest waiting (`dashboard/src/lib/ranking.ts`)
- [x] Design for scanning at a glance on a large display (wide, multi-column — not a single stacked card)

### User Story 4.3

**As a responder, I want to open one incident and see everything about it — location, extracted fields, timeline — so that I have full context before acting.**

- [x] Build incident detail panel: location pin, extracted fields grid, timeline of events — map uses Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set, otherwise free OpenStreetMap
- [x] Wire detail panel to the real-time channel for live updates during an active call — Firestore real-time listeners, verified with `npm run simulate-call`
- [x] Transition detail panel from "live" state to consolidated case record once the call ends

### User Story 4.4

**As a responder, I want to claim an incident and mark its progress, so that my team knows who's handling what and nobody works the same case twice.**

- [x] Add `response` block to the Firestore data model: `status`, `acknowledgedBy`, `acknowledgedAt`, `resolvedAt`, `notes`
- [x] Build Acknowledge / Mark Resolved actions in the dashboard UI — plus Start response and team notes; acknowledge is a Firestore transaction so only one responder can claim; responder name set in-app until real auth exists
- [x] Ensure a status change from one responder's screen reflects on every other subscribed dashboard instance in real time
- [x] Resolving an incident whose call is still live also ends the call (confirm dialog warns); a resolved case never shows as a live call

### User Story 4.5

**As a responder, I want to browse past resolved cases, so that I can review history without it cluttering the live queue.**

- [x] Build case history view (table/list of resolved incidents, filterable) — search plus severity, channel, handled-by and period filters, kept in the URL
- [x] Query Firestore for `status: "resolved"` incidents, separate from the live queue — the live queue likewise queries only open statuses
- [x] Paginate the history list (10 per page, resets to page 1 when filters change)

### User Story 4.6 (added during build — plan §"Monitoring Dashboard": audible/visual alerting)

**As a responder, I want to be alerted the moment a new incident arrives, and keep being alerted until someone picks it up, so that no call goes unnoticed — without being interrupted while I'm working a case.**

- [x] Highlight new incidents in the queue until any responder opens them (`response.viewedAt` / `viewedBy`), and count them in the tab title
- [x] In-app alert toast with an Open button; clears for everyone once the incident is opened
- [x] Siren-style alert sound that repeats until every new incident has been opened by someone
- [x] System (OS) notification when the dashboard tab is in the background — "Enable alerts" button in the header
- [x] Do not disturb: no sound, toast or notification while the responder is on an incident page; held alerts appear silently when they leave
- [x] Visible "Sound is off, click anywhere" banner when the browser has audio locked
- Not included: notifications with the dashboard fully closed (needs Firebase Cloud Messaging + a server, blocked on billing)

---

## EPIC 5 — Demo & Submission Readiness 🔴

*The mandatory hackathon deliverables, plus what actually sells the idea.*

### User Story 5.1

**As the team, we need a working, live-deployed link judges can click into, so that we meet the hackathon's mandatory submission requirement.**

- [x] Both live and stable: dashboard https://quickbite-5cde0-dashboard.web.app, web app https://quickbite-5cde0.web.app. Web app code is in the repo (`web/`). Phase 2 features not yet re-deployed — deploy from `phase-2` before submission.
- [~] Reviewed: no dev-only debug UI in the web app; dashboard's `/dev/camera` is unlinked (gate or remove it before judges if desired). Full pre-submission pass to redo after the Phase 2 deploy.
- [x] Tighten `dashboard/firestore.rules` before the link goes to judges — no deletes, only known fields with valid values, status only moves forward (resolved never reopens), ended calls never go live again, notes/stress history append-only, video handshake docs restricted. Verified allow/deny cases on the Firestore emulator. Still no sign-in: real access control needs Firebase Auth
- [ ] Verify the deployed link end-to-end shortly before submission — do after deploying Phase 2 (runtime check, needs the live env)

### User Story 5.2

**As the team, we need a 3-minute video that convincingly shows the mechanism working, so that judges understand the idea without reading documentation.**

- [x] Demo script written: `docs/demo-script.md` (built around the split-screen live-update beat)
- [ ] Record and edit the video — manual (human/recording step)
- [ ] Rehearse the persona flow end-to-end before recording — manual (rehearsal checklist is in `docs/demo-script.md`)

### User Story 5.3

**As the team, we need a public GitHub repo and a solution deck, so that we meet the remaining mandatory deliverables.**

- [x] `README.md` rewritten with accurate structure, setup, deploy and env-var instructions; confirmed no secrets committed (only `*.example`/emulator templates tracked)
- [x] Deck content written: `docs/deck.md` (includes the Google stack table + competitive-honesty framing). Drop into Slides/PPTX for the file.
- [x] Theme-fit answer written: `docs/theme-fit.md` (societal impact via resilience strengthening + community support; no invented environmental angle). Confirm the team agrees before the deck is final.

---

## EPIC 6 — Stretch: Offline Mesh Relay 🟢

*Only attempt after Epics 1–4 are solid. Reuses infrastructure already designed for the deferred full-platform plan.*

### User Story 6.1

**As a person with no connectivity, I want my silent report to still reach a responder eventually, so that being offline doesn't mean my report goes nowhere.**

- [x] Photo attachment added to the silent tap screen (free-text note already existed) — `SilentTapPage.tsx`
- [x] `web/src/lib/gemini/photoVision.ts` runs Gemini vision on the attached photo → danger indicators + scene observations on the incident
- [ ] Bluetooth mesh relay — **not feasible in this environment** (needs native BLE + two physical devices); genuine stretch, deferred
- [ ] Test the relay with two physical devices — blocked on the above (hardware)

---

## EPIC 7 — Stretch: Back-Camera Video 🟢

*Mobile app only, back camera only, never front. Two independent sub-goals — neither gates the other. Only attempt after Epic 6.*

### User Story 7.1 (Sub-goal A)

**As a responder, I want to watch a live video feed from the reporter's back camera like a video call, so that I have direct visual context, not just text.**

- [x] Evaluate and integrate a managed WebRTC/signaling service (e.g. LiveKit) — do not build signaling from scratch — decided instead: free peer-to-peer WebRTC with Firestore carrying the handshake (managed services need a token server, which needs billing). `shared/video/`
- [ ] Implement back-camera capture on the React Native app, streamed via the signaling service — call `startVideoPublisher()` from `shared/video/publisher.ts` (Person A) — **moved to Phase 2 Story 9.1** (web and native)
- [x] Build the Live Video page on the Monitoring Dashboard (embedded live video player) — medium live-video box in the right column of the incident page + Full screen button to `/incident/:id/video`; connecting / live (only once media flows) / couldn't-connect (retry) / feed lost / ended states. Sender heartbeat every 10s so a feed whose sender vanished shows "Camera feed lost" instead of hanging. Dev test sender at `/dev/camera` (not linked in the UI)
- [ ] Verify: no flash, no shutter sound, no visible preview on the sender's screen (acknowledge the OS-level camera-in-use indicator as an unavoidable, disclosed limitation — do not claim full invisibility)

### User Story 7.2 (Sub-goal B)

**As a responder, I want Gemini to tell me what's visible in the camera feed as structured signal, so that I get AI-assisted context even without watching video myself.**

> **Superseded by Phase 2 Epic 10 (call) and Story 11.3 (silent SOS).** Kept for history.

- [x] **Superseded by Epic 10**: ~1 fps frame capture built in `web/src/lib/gemini/frames.ts`
- [x] **Superseded by Epic 10**: frames sent via `sendRealtimeInput({ video })` alongside the audio session
- [x] **Superseded by Epic 10**: context-window compression + session resumption + reconnect on video sessions
- [x] **Superseded by Epic 10**: `report_scene_observation` → `sceneObservations[]` (not a raw-video UI)

---

# PHASE 2 (planned 2026-09-25)

*Five additions agreed after Phase 1 went live. Ordered by build sequence. Web and native are built in parallel (Epic 12 is the native foundation); icon/name customisation is native-only. Every coded question still follows RULE 1 — its real meaning is spoken in the same sentence.*

**Data-model changes across Phase 2 (agree with Person B before coding — `shared/incidents/types.ts`, `dashboard/firestore.rules`):** `Channel` gains `'click-order'` and `'silent-sos'`; new optional `incidentType: 'report' | 'sos'` and `scenario` (e.g. `'hostage'`); `sceneObservations[] { source: 'camera' | 'sound', kind, detail, confidence, at }`; `adviceGiven[]`; `cameraMode`; `videoRecording` (per camera: `{ camera, status, driveFileId, driveUrl, startedAt, endedAt }`).

*Camera rule change: Phase 1 said "back camera only, never front." The heart SOS (Epic 11) now records the front camera as well, by explicit decision. Calls (Epics 9–10) stay back-camera only.*

---

## EPIC 8 — Click & Order (coded cart → incident) 🔴

*The ordinary checkout path is the second fork from Home, but "Place order" does nothing today (`CheckoutPage.tsx`). A person who can't talk orders coded items instead of calling.*

### User Story 8.1
**As a person who can't safely talk, I want the menu items and add-ons I pick to carry a meaning, so that an ordinary-looking order tells responders what is happening.**
- [x] Scenario codes now live in one shared table (`web/src/lib/codes.ts`); `persona.ts` builds its Step 4 lists from it via `personaCodeList()`, so the call and the cart can't disagree. (Drill-down codes beyond quantity=headcount stay call-only for now — see 8.2 note.)
- [x] Every scenario code has a menu presence in `data/menu.ts` (4 mapped onto existing items, 7 added as add-ons/items via a new optional `code` field); quantity of a coded item = headcount
- [x] Long-press the image in the item detail sheet (`ItemSheet.tsx`) reveals a coded item's real meaning; ordinary items reveal nothing (same 500ms long-press pattern as `SilentTapPage.tsx`)
- [x] QA: coded items read as normal menu entries/add-ons; no visible hint until long-pressed

### User Story 8.2
**As a responder, I want a placed order to arrive as a decoded incident, so that I can act on it like any other report.**
- [x] `CheckoutPage.tsx` "Place order" → `startIncident({ channel: 'click-order' })` + `decodeOrder()` → `updateLiveFields()` (indicators, people count from qty, urgency from a new delivery-speed selector). Only fires when the cart has coded items — an ordinary order raises no incident.
- [x] Rough GPS/IP location attached automatically by `startIncident()`. Address "Change" → `confirmAddress()` NOT built yet (the Change button stays inert); rough location is used, per the plan's default.
- [x] Severity computed by `deriveSeverity()` inside `updateLiveFields()` from the decoded indicators/urgency

### User Story 8.3
**As a person placing a coded order, I want to see a normal "order placed" screen, so that anyone watching sees a finished food order.**
- [x] `OrderPlacedPage.tsx` (`/order-placed`): success + order ID + ETA + status steps; navigates with `replace` and clears the cart, so back doesn't return to checkout
- [x] Order-placed screen mirrors the responder's progress as disguised delivery status (`OrderPlacedPage` subscribes to the incident)
- [x] A coded order and an ordinary order both land on the identical order-placed screen

---

## EPIC 9 — Live Call Video + Google Drive Storage 🔴

*The dashboard can already show live video (Epic 7.1, dashboard side), but the QuickBite app never sends any. This epic wires the sender in and keeps a permanent copy in the team's Drive.*

### User Story 9.1
**As a responder, I want to watch the caller's back camera live while the call is happening, so that I can see the situation, not just hear about it.**
- [x] `web/src/lib/gemini/media.ts` `acquireCallMedia()` opens mic + back camera in one `getUserMedia` (falls back to audio-only if no camera); the audio track feeds Gemini, the video track the feed + recorder
- [x] `CallPage.tsx` calls `startVideoPublisher()` with a video-only view of the stream and stops it on call end (SOS wiring is Epic 11)
- [x] No camera preview is ever rendered on the caller's screen; OS camera indicator disclosed as unavoidable
- [ ] Native: same flow through `react-native-webrtc` + `registerGlobals()` — pending Epic 12 (native app)
- [ ] Test on a real phone against the live dashboard's video box — pending device test

### User Story 9.2
**As the response team, I want every call's video saved to our own Google Drive, so that the footage is kept after the call ends and can be reviewed later.**
- [ ] Set up the team Drive folder — steps in `docs/setup/drive-uploader.md` (team action, needs their Google account)
- [x] Upload route chosen + built: Google Apps Script web app (no sign-in, no billing). Client in `web/src/lib/gemini/videoUpload.ts`, gated by `VITE_DRIVE_UPLOAD_URL`; script + deploy steps in `docs/setup/drive-uploader.md`
- [x] `videoRecorder.ts` records video + call audio; the recording-so-far is uploaded every ~20s (overwriting by filename) and once at the end, so a call killed mid-way still leaves footage. Apps Script trashes the prior version first.
- [x] `videoRecording[]` (per camera) written via `upsertVideoRecording()`: `recording` at start → `uploaded`/`failed` with `driveFileId`/`driveUrl` after upload
- [ ] Native: pick a recording approach (spike) — pending Epic 12
- [x] Public-uploader-URL limitation documented in `docs/setup/drive-uploader.md` (deck: pull from there)

---

## EPIC 10 — Vision- and Sound-Aware Live Call 🟡

*Supersedes Epic 7.2 for the call path. Gemini sees what the camera sees (~1 frame/sec, not continuous video — don't overclaim) and hears what's happening around the caller (gunshots, other voices), and uses both to ask better questions and give quick safety advice.*

### User Story 10.1
**As a caller, I want the AI to see what my camera sees during the call, so that I don't have to describe everything out loud.**
- [x] `web/src/lib/gemini/frames.ts` samples the camera to JPEG ~1 fps (downscaled) and `liveSession.ts` sends each via `sendRealtimeInput({ video })`
- [~] Wired for `gemini-3.8-live` video input — still **needs a live test** to confirm the free tier accepts frames (no running key here)
- [x] Video sessions enable `contextWindowCompression` + `sessionResumption`; `liveSession.ts` keeps the resumption handle and transparently reopens the session on an unexpected mid-call drop (audio-only calls keep the proven config unchanged). Needs a live test.
- [x] `report_scene_observation` tool → `reportSceneObservation()` → `sceneObservations[]` with `source: 'camera'`, kept separate from the caller's words

### User Story 10.2
**As a responder, I want the AI to pick out important background sounds on the call, so that I learn about danger the caller can't or won't describe.**
- [x] Persona now instructed to listen to the background (gunshots, screams, other voices + language, glass, banging, sirens, alarms) using Gemini Live's native audio, no separate model
- [x] Background sounds reported via `report_scene_observation` `source: 'sound'` (kind + detail + confidence); overheard words go to notes
- [x] Dangerous observations become danger indicators in the same transaction and lift severity; `deriveSeverity()` now treats gunshot/scream/fire/etc as high
- [ ] Rehearse with played-back sound clips during a test call — pending manual test

### User Story 10.3
**As a caller, I want the AI to ask me about what it sees and hears, so that responders get details I wouldn't think to mention.**
- [x] Persona asks a follow-up disguised choice about what it sees/hears (RULE 1 + RULE 2 preserved)
- [x] Persona explicitly forbidden from saying aloud what it sees/hears (no "I can see…", no "was that a gunshot?")
- [ ] Rehearse with staged scenes — pending manual test

### User Story 10.4
**As a caller in danger, I want short, direct safety advice during the call, so that I know what to do while help is on the way.**
- [x] Persona gives brief disguised safety advice in-call, one at a time, only when relevant
- [x] Advice limited to basic safety/first aid; no diagnosis, no arrival-time promises (in the persona)
- [x] `report_advice` tool → `recordAdvice()` → `adviceGiven[]`; shown in the dashboard timeline

---

## EPIC 11 — Heart Double-Tap Silent SOS (hostage scenario) 🔴

*For when the person can't talk, type or even hold a call screen. A double-tap on the heart at the top of Home starts a silent SOS: the app records voice and video, streams it live, lets AI build the incident, and makes the screen look switched off.*

### User Story 11.1
**As a person being held, I want a hidden double-tap on the heart icon to start a silent SOS, so that I can call for help with one quick, natural gesture.**
- [x] Double-tap the heart in `TopBar.tsx` (within 400 ms) navigates to `/sos`; a single tap does nothing unusual
- [x] No visible confirmation; no haptics triggered
- [x] `SosPage` calls `startIncident({ channel:'silent-sos', incidentType:'sos', scenario:'hostage', severity:'high' })`. (Used 'high' — a new 'critical' level would ripple through severity chips/ranking/rules; deferred. SOS badge distinguishes it.)
- [ ] Same trigger in the native app — pending Epic 12

### User Story 11.2
**As a person being held, I want the phone to look switched off while it keeps recording, so that nobody notices it is working.**
- [x] Full-screen black overlay swallows all touches (`SosPage` + `.sos-blackout`). Browser can't hide the OS status bar; the native app can (Epic 12).
- [x] Screen Wake Lock requested (best-effort) so the OS doesn't pause the camera/mic. Web can't dim the screen (overlay is pure black); native brightness dimming is Epic 12. Fullscreen not force-requested (navigation drops the gesture); the overlay covers the app regardless.
- [x] Records both cameras + mic where the device allows two streams (`acquireSosMedia`); falls back to back-only otherwise. `cameraMode` ('dual'/'back-only') saved on the incident.
  - Native: run both cameras at once where supported — pending Epic 12
  - Time-sliced alternating fallback — native only (Epic 12); web uses dual-or-back-only
  - [x] Capability detected at SOS start; `cameraMode` recorded
- [x] No preview/flash/shutter from either camera; OS camera indicator disclosed as unavoidable
- [x] Three taps anywhere on the screen (within 1.5s) end the SOS, stop everything, and `zeroTraceExit()` home. Every teardown step is time-capped (consolidation 8s), so the exit can't hang
- [ ] Test in a dark room for any visible light/flicker — pending manual test

### User Story 11.3
**As a responder, I want the AI to watch and listen to the silent SOS and fill in the incident live, so that I know what is happening even though nobody is talking to me.**
- [x] `silentSession.ts`: mic + ~1 fps frames from both cameras in. AUDIO response modality (`gemini-3.8-live` rejects TEXT with close 1007); the model's audio is never played, so nothing is heard in the room
- [x] `SILENT_OBSERVER_INSTRUCTION` covers captor/hostage counts, weapons, injuries, overheard names/demands, background sounds, location clues, changes over time; uses `report_situation`/`report_scene_observation`/`report_stress_level`
- [x] Both cameras stream live to the dashboard (switchable Back/Front) and both are recorded to Drive (one file per camera)
- [x] Compression + session resumption + auto-reconnect in `silentSession.ts`
- [x] Consolidation + leakage check run on SOS end, same as a call
- [x] Reconnects after idle closes even without a resumption handle (a quiet SOS idles out early); counter resets on each reopen
- [x] What the mic hears is written live to `transcriptLines` (one line per utterance), so the dashboard Conversation tab fills during the SOS
- [x] `report_caller_estimate` handled (caller age/gender estimate in the bulletin)
- [x] Mic-only listen-in feed published, so the dashboard's live audio panel works for SOS
- [x] Mic audio is recorded inside each camera's Drive file (no separate audio file); files go in one Drive subfolder per incident. Verified 2026-09-28: `back.webm` plays with audio (Drive's preview can't play it, so download it first). Dashboard notes this under Evidence recordings
- [x] Verified end to end on desktop (INC-MUL29YGP, INC-MUL2NRUT): threats, weapon, headcount, voice stress, transcript, bulletin
- [ ] Test on a real iPhone — pending

---

## EPIC 12 — Native App Foundation (React Native) 🔴

*Native foundation scaffolded on branch `phase-2` — **UNTESTED** (no Expo toolchain/device in the build env). See `native/README.md`. UI + incident-writing ported; Gemini AV + WebRTC stubbed.*

### User Story 12.1
**As a developer, I want a React Native app that shares the incident and video code with web, so that both apps write the same incidents to the same dashboard.**
- [x] Expo dev-build scaffold: `package.json`, `app.json`, `tsconfig`, `babel.config.js`, `index.ts` (registers WebRTC globals), `App.tsx` (React Navigation). Untested.
- [x] `native` added to the workspace; screens import `../../../shared/incidents`, `shared/video`, `shared/codes` directly (codes.ts moved to `shared/` so all three apps share it)
- [x] `native/src/lib/firebase.ts` reads `EXPO_PUBLIC_FIREBASE_*` (copy the web values)

### User Story 12.2
**As a person using the phone app, I want the same disguise and the same two forks as the web app, so that it looks like an ordinary installed delivery app.**
- [~] Ported: Home (with heart-double-tap SOS), Cart, Checkout (coded-order), OrderPlaced, Silent tap, Settings. Call + SOS screens are shells (AV pending).
- [ ] Gemini Live on RN (PCM capture/playback + camera frames) — **stubbed** in `native/src/lib/nativeCall.ts` with the exact plan; reuses the web conversation logic. Not implemented.
- [x] Zero-trace exit uses `navigation.reset()` to Home (no back history)
- [ ] Test on a real Android phone — pending (couldn't build/run in this env)

---

## EPIC 13 — Disguise Personalisation (native only) 🟡

*Lets the person make the app match the apps already on their phone. A disguise everybody recognises as "QuickBite" is weaker than one the user picked.*

### User Story 13.1
**As a person using QuickBite, I want to change the app's icon and name, so that it blends in with the other apps on my phone.**
- [x] `SettingsScreen` ("App appearance"), reached from the Account button, styled as a normal setting
- [~] 6 icon presets in the UI (`ICON_PRESETS`); the OS alternate-icon switch is stubbed in `appearance.tsx setIcon()` (needs icon assets + a config plugin)
- [x] Free-text app name shown across the native app (home top bar, call screen "… Order Desk") via `useAppearance()`
- [x] OS limitation stated in the Settings screen + README
- [~] Native reads the name from one place (`appearance.tsx`). The **web** app's brand strings are still hard-coded — centralising those is outstanding.

### User Story 13.2
**As a person who customised the app, I want my icon and name to stay the same after I close or restart the app, so that it never flips back to "QuickBite".**
- [x] Persisted with AsyncStorage (`appearance.tsx`)
- [x] Loaded in `AppearanceProvider` before the first screen renders (`ready` gate)
- [ ] Test across kill/reboot on a device — pending

---

## EPIC 14 — Dashboard Support for Phase 2 🟡 (Person B)

*Everything above writes new data. The dashboard needs to show it.*

### User Story 14.1
**As a responder, I want SOS and click-order incidents to stand out and read clearly, so that I can tell a silent hostage SOS from an ordinary report at a glance.**
- [x] `types.ts` + `firestore.rules` extended with every Phase 2 field (channels, incidentType, scenario, cameraMode, videoRecording, videoFront, sceneObservations, adviceGiven). Needs the team's explicit sign-off.
- [x] Shared `channelLabel()` covers `click-order` ("Coded order") and `silent-sos` ("Silent SOS") everywhere; SOS badge + scenario shown in the queue and on the detail page; `cameraMode` shown on detail
- [x] `click-order` and `silent-sos` in the Case history channel filter. Analytics channel breakdown still pending.

### User Story 14.2
**As a responder, I want to see what the AI saw, what the caller was told, and the saved video, so that I have the full picture in one place.**
- [x] "Seen & heard" panel for `sceneObservations[]` on the detail page; gunshot/scream/weapon also shown as a high-tone timeline alert
- [x] Advice-to-caller entries from `adviceGiven[]` shown in the event timeline
- [x] Live video box has a Back/Front toggle for a dual-camera SOS (each camera published as its own feed); labels the current camera
- [x] "Call video" card on the detail page (Drive link per camera, statuses). Two-feed live view done (Back/Front toggle). Embedded Drive preview not added (link opens Drive).

---

## Notes for using this backlog

- **Epics 1, 3, and 5 are the non-negotiable core** — if the 4 weeks run short, everything else (Epics 2, 4-partial, 6, 7) is where scope gets cut first, per the plan's own priority tiers.
- Epic 4 (Dashboard) got real scope in a later planning pass — don't under-budget it as "just wire up the data feed."
- Epics 6 and 7 are explicitly sequential stretch goals (7 only after 6), and within Epic 7, stories 7.1 and 7.2 are parallel, not sequential.
- **Phase 2 build order**: Epic 8 (smallest, closes the dead "Place order" button) → 9 (video sender, which 10 and 11 reuse) → 10 → 11. Epic 12 (native foundation) runs in parallel from the start, and Epic 13 follows it. Epic 14 (Person B) tracks each app-side epic as its data lands. Agree the Phase 2 data-model changes with Person B before Epic 8 starts.
- **Phase 3 build order**: Epic 15 (persona/call-flow refinements) has no dependencies and can start immediately — pure `persona.ts`/`liveSession.ts` changes. Epic 16 (dashboard reasoning/confidence/bulletin) is independent of 15. Epic 17 (annotated live transcript + replay scrubber) needs transcript lines persisted live to Firestore first (currently only held locally in `liveSession.ts` until call-end) — do this once, shared by both stories. Epic 18 (live-redrawing scene sketch) is its own build, no dependency on 15–17. Epic 19 (cross-incident correlation + nearby services) is independent of the others and safe to parallelize.

---

# PHASE 3 (planned 2026-09-26)

*Drawn from `covert_call/docs/extended_feature_brainstorm.md` — see that doc for the full reasoning, the 911-transcript
source material, and every feature discussed (including ones not brought into this backlog). Only the features
below were selected to actually build; the brainstorm doc has more (larger bets like second-voice detection, the
responder live-nudge channel, and the wow-factor items not listed here) kept as reference, not yet committed.
Every coded question still follows Epic 1's RULE 1 — its real meaning is spoken in the same sentence.*

---

## EPIC 15 — Persona & Call-Flow Refinements 🟡

*Small, low-risk changes to `persona.ts`/`liveSession.ts` informed by real 911-call patterns. No new data-model
fields except where noted.*

### User Story 15.1
**As a caller pausing mid-thought, I want Mia to stay present during ordinary silence, so that the call doesn't feel like it's gone dead.**
- [ ] Add an instruction to `persona.ts` for a short, in-character reassurance line ("no rush, take your time with the order") during a normal few-second pause — distinct from, and well before, `liveSession.ts`'s existing 3-strikes silence watchdog (~8s threshold)
- [ ] Rehearse: a 2-4 second pause mid-answer gets a short reassurance, without tripping the silence-tracking counter

### User Story 15.2
**As a caller who can barely speak, I want Mia to guess and let me just confirm, so that I'm not forced to keep picking from menus when even that is too much.**
- [ ] Add a fallback-mode instruction to `persona.ts`: when answers get shorter/quieter/more strained, switch from offering 2-3 options to stating a specific guess for a plain yes/no confirmation, reusing the same coded vocabulary
- [ ] Rehearse: deliberately answering in short, quiet single words shifts Mia's questions from menus to single-guess confirmations within a round or two

### User Story 15.3
**As a responder, I want a call that drops unexpectedly to look different from one that ended normally, so that I know a dropped call may still be an active emergency.**
- [ ] Track end reason in `liveSession.ts`: clean `end_call` (already sets `finished = true`) vs. `onclose` firing without that flag — the latter is an unexpected disconnect
- [ ] Add `callEndReason: 'confirmed' | 'dropped' | 'silence-timeout'` (or similar) to `shared/incidents/types.ts`, set by `endIncident()` in `shared/incidents/client.ts`
- [ ] Feed the dropped state into `deriveSeverity()` in `shared/incidents/severity.ts` — a call cut off mid-danger-report is its own severity signal
- [ ] Dashboard: distinct visual treatment for a dropped call on `IncidentDetailPage.tsx` (e.g. a red "Call dropped — not confirmed ended" banner instead of the calm "Case record" banner)
- [ ] Try once, don't build a retry system: on detecting a drop, show a short-lived "Attempting callback..." status before settling to its final label — an honest, protocol-accurate touch (no real telephony exists to actually call back on)
- [ ] Test: killing the mic/network mid-call results in an incident marked dropped, not ended, with adjusted severity

### User Story 15.4
**As someone watching a live event happen to a third party, I want a scenario code for reporting it in progress, so that responders ask about what's happening right now, not treat it like a past-tense witness report.**
- [ ] Add a new Round 1 disguised code to `persona.ts`'s Step 4 (and `shared/codes.ts`, so the call and any future coded-cart mapping stay in sync per Epic 8.1's shared-table pattern) for an ongoing third-party observation, distinct from the existing "family combo" (witnessed-crime, past-tense) code
- [ ] Add Round 2+ drill-down questions specific to this code: still happening / can still see or hear them / which direction / which floor or unit
- [ ] Rehearse: describing "I can see my neighbor's argument through the window right now" routes to these ongoing-observation questions, not the past-tense witnessed-crime ones

### User Story 15.5
**As a caller in danger, I want safety advice that's anchored to what I've actually described, not a generic canned line, so that it's actually useful to my specific situation.**
- [ ] Tighten Epic 10.4's existing advice-giving instructions in `persona.ts` so every piece of advice explicitly references a detail already reported in that specific call (the caller's own described environment — near a door, in a specific room, a specific injury) rather than being picked from a fixed list regardless of context
- [ ] Rehearse: staged scenarios describing a specific environment (e.g. "near the front door") get advice referencing that specific detail, not a generic safety line

---

## EPIC 16 — Responder Decision Support (Reasoning, Confidence, Bulletin) 🟡

*Turns the dashboard from "extraction system" into something closer to decision support — showing why, not just what, and formatting the case the way real dispatch bulletins read.*

### User Story 16.1
**As a responder, I want to see why the AI raised severity, not just the resulting chip, so that I can trust the system's reasoning instead of treating it as a black box.**
- [ ] Add a `reasoningTrace[]` array to `shared/incidents/types.ts`; append one short, plain-language line (e.g. "Urgency raised to HIGH — weapon reported 12s ago, voice stress crossed 75") whenever `updateLiveFields()`/`recordVoiceStress()` in `shared/incidents/client.ts` actually changes severity or urgency — not on every write
- [ ] New live-scrolling panel on `IncidentDetailPage.tsx` rendering the trace as it grows during a call
- [ ] Test: during a live call, urgency escalating produces a new reasoning-trace line explaining the trigger in real time

### User Story 16.2
**As a responder, I want to see a field's confidence sharpen live during the call, so that I can tell "just mentioned once" from "confirmed" without waiting for the call to end.**
- [ ] Extend `updateLiveFields()` to set a live confidence level per field it writes (inferred on first report, upgraded to confirmed for fields with an explicit confirmation path like `confirm_address`, or on repetition/elaboration across later rounds)
- [ ] Animate the existing `Confidence` component on `IncidentDetailPage.tsx` to visibly move between states live, not just show the static post-consolidation value from `fieldConfidence`
- [ ] Test: a field's confidence visual moves from a dim "uncertain" state to a solid "confirmed" state as Mia gathers more detail about it during the call

### User Story 16.3
**As a responder, I want one clear recommended action, not just a severity chip I have to interpret myself, so that I know what to actually do.**
- [ ] Derive a short recommendation sentence (e.g. "Recommend immediate police dispatch") alongside `deriveSeverity()` in `shared/incidents/severity.ts`, from the same inputs (dangerIndicators, urgency, voiceStressScore) — deterministic/rule-based, not a separate Gemini call, so it stays explainable
- [ ] Render prominently on `IncidentDetailPage.tsx` near the severity chip
- [ ] Test: an incident with a weapon indicator and high urgency shows a clear recommendation line, not just a severity chip

### User Story 16.4
**As a responder, I want the consolidated case formatted like a real dispatch bulletin, so that I can scan it as fast as an actual broadcast, not read it like a report.**
- [ ] Extend `consolidate.ts`'s `responseSchema` to also produce a rigid bulletin block (LOCATION / SUBJECTS / WEAPONS / VEHICLE / STATUS / RECOMMENDED ACTION — the last one reusing 16.3's recommendation), alongside the existing prose `consolidatedSummary`
- [ ] Add the structured bulletin field to `shared/incidents/types.ts`; new styled (monospace, bulletin-look) card on `IncidentDetailPage.tsx`, visually distinct from the prose summary
- [ ] Test: a consolidated case shows both the existing prose summary and a separate terse bulletin card

### User Story 16.5
**As a responder, I want a one-click shareable version of the current brief, so that I can hand it to someone dispatching over radio who isn't looking at this screen.**
- [ ] Button on `IncidentDetailPage.tsx` that copies (and/or prints via a dedicated print stylesheet) 16.4's bulletin format as a point-in-time snapshot — build after 16.4 exists, reuse its fields rather than inventing a second format
- [ ] Test: clicking the button on a test incident copies a clean, radio-readable bulletin of current known facts

### User Story 16.6
**As a responder, I want nearby police/fire/hospital contacts once a location is confirmed, so that I don't have to look them up myself before dispatching.**
- [ ] New function alongside `shared/incidents/geocode.ts` (e.g. `nearbyServices.ts`) querying the free OpenStreetMap Overpass API (or Google Places Nearby Search if a Places-enabled key is ever configured), triggered once `location.confirmed` is set
- [ ] New card on `IncidentDetailPage.tsx`: name, approximate distance, phone number where available, a `tel:` "Call station" link per result
- [ ] Auto-suggest which service to lead with based on `dangerIndicators`/urgency (weapon/threat → police, fire/smoke → fire service, injury → hospital) as a simple highlight/ordering, not a hard rule
- [ ] Test: a test incident with a confirmed address shows at least one real nearby police station and hospital with a working phone link, no paid API key required

### User Story 16.7
**As a responder already on an incident, I want a distinct sound the instant it escalates, so that I notice even if I'm not staring at the severity chip.**
- [ ] `IncidentDetailPage.tsx`: play a short, distinct one-shot sound (separate audio asset from Epic 4.6's siren) the instant severity increases on the currently-open incident — deliberately does not respect Epic 4.6's "do not disturb while on an incident page" rule, since the responder is already on the exact incident that escalated
- [ ] Test: a responder with the detail page open hears the distinct cue the instant severity increases during a live call

### User Story 16.8
**As a responder reopening an incident, I want to see just what changed since I last looked, so that I don't have to re-scan every field from memory.**
- [ ] Snapshot field state alongside `response.viewedAt` updates (or reuse whatever change-tracking 16.1's reasoning trace ends up building — design these two together, both answer "what changed and when")
- [ ] New banner on `IncidentDetailPage.tsx` summarizing the delta on reopen (e.g. "Since you last checked: address confirmed, urgency raised to high, 2 new notes")
- [ ] Test: a responder who viewed an incident, left, and returns after new fields were reported sees a one-line summary of exactly what changed

### User Story 16.9
**As a responder who isn't currently watching an incident, I want to be re-alerted when something material changes, not just when it's first created, so that I don't miss an escalation while looking elsewhere.**
- [ ] Extend Epic 4.6's alert logic to distinguish "a new fact was added" from "the situation just materially changed" — specifically: address confirmed for the first time, a new dangerIndicator added after the incident is already at least medium severity, or urgency escalating past its previous recorded level
- [ ] On any of these, re-trigger the same alert path Epic 4.6 built for new incidents (toast + siren-style sound + tab title count), scoped to responders not currently on that incident's detail page — Epic 4.6's existing "do not disturb while on an incident page" rule still applies here (contrast with 16.7, which deliberately overrides that rule for a responder already on the page)
- [ ] Test: a responder on the live queue (not the detail page) gets a second alert when a weapon indicator is added mid-call, distinct from the initial "new incident" alert

### User Story 16.10
**As a responder, I want factual, non-personal context (like weather near the incident), so that I have a fuller picture without looking it up myself.**
- [ ] Use Gemini's Search grounding tool (available on the free tier, same `@google/genai` client already used for `consolidate.ts`/`leakageCheck.ts`), narrowly scoped to non-personal facts only — weather/road conditions near the confirmed location, or a sanity check that an address corresponds to a real location. Never pass a person's name into this — scope the prompt tightly enough that it can't be repurposed as a people-search tool, consistent with this document's explicit rejection of identity lookups
- [ ] Wire into the consolidation pass or a standalone helper, triggered once location is confirmed
- [ ] Test: a consolidated test incident's detail page shows a one-line grounded fact (e.g. current weather near the location) sourced from a real Search grounding call, not a hardcoded value

---

## EPIC 17 — Live Transcript & Replay 🟡

*Both stories below need transcript lines persisted live to Firestore, not just held locally in `liveSession.ts`'s `transcriptLines` array until call-end as today — solve this once, shared by both.*

### User Story 17.1
**As a developer, I want transcript lines written live during the call, so that both the annotated live view and the post-call replay scrubber have real timestamped data to work from.**
- [ ] Write each transcript line (from `liveSession.ts`'s `appendTranscript()`) to Firestore progressively during the call — a new subcollection or timestamped array field, not just the end-of-call local array used today
- [ ] Also track field-level update timestamps (currently only the latest value is stored in `extractedFieldsLive`, not a history of when each value changed) — needed for 17.3's scrubber to reconstruct "what was known at time T"

### User Story 17.2
**As a responder, I want to see the coded phrases in the live transcript automatically decoded, so that the disguise mechanism is obvious on screen without me explaining it.**
- [ ] New transcript display component on `IncidentDetailPage.tsx`, fed by 17.1's live-written transcript data
- [ ] Match transcript text against `shared/codes.ts` (the shared code table from Epic 8.1) client-side; render matched coded phrases with their real meaning shown inline (e.g. struck-through phrase + "→ weapon present")
- [ ] Render with a streaming/typewriter reveal (not blocks appearing all at once), timed so a coded phrase's annotation pops in right as that phrase finishes appearing
- [ ] Test: during a live demo call, the transcript streams in with coded phrases visibly highlighted and annotated in real time

### User Story 17.3
**As a responder reviewing a case afterward, I want to scrub to any moment and see the transcript, fields, and stress level as they were then, so that I can reconstruct the call without cross-referencing multiple views by eye.**
- [ ] Timeline scrubber on `IncidentDetailPage.tsx` (shown once a case is consolidated), reading 17.1's timestamped transcript + field-update history + the existing `voiceStressTrend` (already timestamped)
- [ ] Dragging to a point in time shows only the transcript up to then, only the fields extracted by then, and the stress value at that instant
- [ ] Test: on a consolidated test case, dragging to the midpoint shows the partial picture as it stood then, not the full final state

---

## EPIC 18 — Live Scene Reconstruction 🟢

*Stretch — schematic/iconographic only, never photorealistic, never an attempt to depict a real person's likeness (see the brainstorm doc's explicit safety framing). Spike the layout-generation approach before committing further.*

### User Story 18.1
**As a responder, I want to watch a simple scene diagram assemble itself live during the call, so that I get a visual sense of the situation without waiting for a final summary.**
- [ ] Spike: can a structured layout description (positions/icons for people, weapon, vehicle) be reliably derived from `extractedFieldsLive` + `sceneObservations[]`, rendered as SVG/icons — check this works before building the full incremental-update version
- [ ] Build as an incremental component: each relevant tool call (`report_situation`, `confirm_address`, `report_scene_observation`) triggers one small targeted SVG update (add/move/rotate one icon) rather than regenerating the whole image every time
- [ ] Test: during a live test call, icons appear and change one at a time, timed to when each fact is actually reported

### User Story 18.2
**As a responder reviewing a consolidated case, I want one clean summary image of the incident, so that I have a single visual to anchor the case record (and the deck/demo).**
- [ ] At consolidation time, generate one finished schematic composite (reusing 18.1's layout approach) — new field on the incident record, new card on `IncidentDetailPage.tsx`
- [ ] Explicitly document (in the deck/video, not just code comments) that this is iconographic only, never a real-likeness depiction — this framing must travel with the feature anywhere it's described publicly

### User Story 18.3
**As a responder, I want to feel the caller's stress rise, not just read a number, so that a live demo or a live case has an immediate emotional read, not just a data point.**
- [ ] Replace or augment the existing `StressMeter`/`StressSparkline` components with an animated waveform, pulse, or color-shifting visual synced to `report_stress_level` updates (already fired every ~15-20s per `persona.ts`) — amplitude/color intensifying as the score rises
- [ ] Stretch: tap the raw mic audio stream directly via the Web Audio API's analyser node on `player.recordingStream`/mic stream (already available in `audio.ts`) for a continuous live waveform, rather than animating only between periodic score updates
- [ ] Test: during a live test call, the stress visualization visibly changes in real time, not just updating a number every 15-20 seconds

### User Story 18.4
**As a judge/demo audience watching a call happen, I want to see what the AI is currently doing internally, so that the mechanism is narrated visually without talking over the live call audio.**
- [ ] Build a demo-only status line ("Listening for danger signals... / Confirming address... / Assessing urgency...") inferred from which tool calls have fired so far in `liveSession.ts` (e.g. `confirm_address` called → now past the address step) — no new tool-calling overhead purely for this
- [ ] Gate this strictly behind a demo-mode flag or a separate demo build, rendered only on a second screen mirroring the call (for a judge or camera) — **must never appear on the real caller-facing `CallPage.tsx`**, since it would immediately break the disguise if visible to anyone glancing at the caller's phone
- [ ] Test: a separate demo-mode view shows a live-updating status line during a test call; confirm the real `CallPage.tsx` shows nothing of the kind

### User Story 18.5
**As a responder, I want to see multiple incidents clustered on one map by severity, so that the system reads as monitoring infrastructure, not a single clever call.**
- [ ] Add a map view mode showing severity-colored clustering across multiple incidents at once, reusing the existing `IncidentMap.tsx` component (Google Maps or free OpenStreetMap) with multiple incidents passed in instead of one
- [ ] Tie into Epic 19.1 (cross-incident correlation) — visually link correlated incidents on this same view where practical
- [ ] Test: with 2-3 seeded/simulated incidents active, the map view shows them clustered and colored by severity

---

## EPIC 19 — Cross-Case Intelligence 🟢

*Stays entirely inside data we already legitimately hold — no external identity lookups. See the brainstorm doc's explicit rejection of any "search a named person, pull public photos/records" feature; this epic is the honest, in-scope version of that idea.*

### User Story 19.1
**As a responder, I want to know if this incident's address, vehicle, or name matches another open or recent report, so that I can see patterns across cases, not just within one.**
- [ ] New file alongside `consolidate.ts`/`leakageCheck.ts` (e.g. `correlate.ts`): at consolidation time, check the new incident's confirmed address, any vehicle description, and any name mentioned against other open/recent incidents already in Firestore — pull the last N incidents' key fields, ask a client-side Gemini text call (same structured-JSON pattern as `consolidate.ts`) whether any appear to describe the same person/vehicle/location
- [ ] Write `correlatedIncidentIds: string[]` (or similar) to the incident record via a new `shared/incidents/client.ts` function
- [ ] Small "Possibly related" card on `IncidentDetailPage.tsx` linking to matched incidents
- [ ] Test: two test incidents seeded with the same address or vehicle description show a "possibly related" link to each other once consolidation runs on the second one

### User Story 19.2
**As a responder, I want to see a moving target's trail on the map, not just a growing list of address strings, so that a possible-abduction scenario's pattern of movement is legible at a glance.**
- [ ] Extend `IncidentMap.tsx` with an annotation layer (Leaflet, matching the existing free OpenStreetMap path, or the Google Maps JS API — both support drawing polylines/markers on top of an existing map) — start manual: a responder clicks/drags to mark a direction or waypoint as they read new landmarks off the notes feed
- [ ] Stretch, only if time allows: auto-plot the trail by geocoding every intermediate landmark mention (not just the final confirmed address) as the persona's "MOVING?" drill-down (`persona.ts`, Step 5) gathers them, connecting successive points with an animated polyline as they arrive
- [ ] Test: during a test call flagged as possible abduction, the responder can mark or see a visual trail on the map reflecting the reported direction of travel, not just a single static pin

---

## EPIC 20 — Live Responder Workflow Speed 🟡

*Small, high-leverage additions to how fast a responder can act during a live incident — distinct from Epic 16's decision-support content, this epic is about interaction speed.*

### User Story 20.1
**As a responder, I want a single keypress to jump to the most urgent open incident, so that I don't have to click through the queue and visually scan every time I finish one case.**
- [ ] Add a global keydown listener (dashboard's top-level layout/`App.tsx`) for a hotkey (e.g. spacebar or `N`) that navigates to whichever open, unacknowledged incident ranks highest per the existing `dashboard/src/lib/ranking.ts` sort — no new prioritization logic, just a shortcut to its result
- [ ] Small, non-intrusive discovery hint (a shown-once tooltip or corner label) so responders learn the shortcut exists
- [ ] Test: with several open test incidents at different severities, pressing the hotkey from anywhere in the dashboard jumps to the same incident that sits first in the live queue's own ranking

---

## EPIC 21 — Bigger Bets (reference only, not yet sized) 🟢

*The largest, most speculative items from the brainstorm doc — deliberately not broken into buildable sub-tasks yet, since each needs a scoping/feasibility decision before that's useful. Attempt only after Epics 15-20 are solid, and only if time remains. See `covert_call/docs/extended_feature_brainstorm.md` for full detail on each.*

### User Story 21.1 — Second-voice detection, in-character extraction, and second-party stress reading (→ promoted to Epic 24, Phase 4)
**As a responder, I want to know if someone other than the original caller has taken the phone, so that Mia can adapt and extract more instead of continuing to address someone who's no longer there.**
- [ ] Prototype voice-change detection in isolation first (a throwaway test call where a second person deliberately joins mid-call) before committing further — false positives here are actively harmful, so do not build anything on top of this until detection is shown to be reliable
- [ ] If reliable: persona instructions for staying in character and extracting useful information from a suspected second speaker (`persona.ts`), plus a distinct second-party stress reading (extending `report_stress_level`'s pattern, stored separately from the original caller's `voiceStressScore`/`voiceStressTrend`)
- [ ] Cut this bundle entirely rather than ship it half-working if detection isn't reliable in rehearsal — a confidently-wrong "second voice detected" signal is worse than no signal

### User Story 21.2 — Responder live-nudge channel (→ promoted to Epic 23, Phase 4)
**As a responder, I want to inject a short instruction into an in-progress call, so that I can intervene the moment I see something the AI should ask about right now.**
- [ ] New Firestore subcollection (e.g. `incidents/{id}/nudges`) + rules, written from a small input UI on `IncidentDetailPage.tsx`
- [ ] `liveSession.ts` listens for new nudges and injects them via `session.sendClientContent()`, reusing the same `(System note, not the caller: ...)` pattern the existing silence-watchdog already uses
- [ ] Careful phrasing review so an injected nudge can never break the caller's disguise cover
- [ ] The single largest engineering lift in this document — treat as a stretch to attempt only after everything else here is solid

### User Story 21.3 — AI-drawn abduction trail
**As a responder, I want the system to draw the movement trail automatically, so that I don't have to plot it by hand.**
- [ ] Depends on 19.2 existing first (same `IncidentMap.tsx` annotation layer) and requires geocoding every landmark mention, not just the final address — the harder variant already flagged as a stretch under 19.2

### User Story 21.4 — Live Gemini-narrated "responder co-pilot" text stream
**As a responder, I want a running synthesis of how separately-reported facts connect, not just a log of what changed, so that I catch connections I might miss on my own.**
- [ ] A distinct, lightweight periodic Gemini text call (every 20-30s, fed current extracted fields + recent history) producing short connective observations, only when something is actually worth saying
- [ ] Consider whether this and 21.5 (disguise-integrity meter) could share one periodic call rather than running as two separate timers, for cost/latency reasons

### User Story 21.5 — Live "disguise integrity" self-monitoring meter
**As a responder, I want to know if the call has ever risked blowing its own cover, so that a slipped disguise is caught, not silently missed.**
- [ ] A lighter, continuously-running variant of the existing leakage-check logic (Epic 2.2), checking the model's own recent responses against the same "does this sound like it's blowing its own cover" criteria, surfaced as a live green/amber/red indicator
- [ ] Needs real rehearsal-time validation before trusting it — must not cry wolf on ordinary in-character lines, or the indicator itself becomes noise
- [ ] Test: the indicator stays calm through normal in-character conversation, and visibly flags a deliberately staged in-call break-of-character line introduced during rehearsal

### User Story 21.6 — Living "case constellation" correlation graph
**As a responder, I want correlated incidents shown as a connected, pulsing graph, so that cross-case intelligence reads as alive, not a static text link.**
- [ ] Depends entirely on 19.1 (correlation data) and 18.5 (multi-incident map/overview) already existing — not worth attempting before those are solid
- [ ] Render correlated incidents as connected nodes with an animated pulse/glow the instant a new correlation is detected, as a separate mode alongside 18.5's map view

---

# PHASE 4 (planned 2026-10-01)

*Full detail in [`phase4_call_intelligence_spec.md`](phase4_call_intelligence_spec.md). Promotes 21.1 to Epic 24 and 21.2 to Epic 23. Agree data-model changes (`shared/incidents/types.ts`, `dashboard/firestore.rules`) with Person B before coding. Native imports persona/tools from web, but `native/src/lib/gemini/liveSession.ts` changes must be mirrored by hand.*

## EPIC 22 — Goal-Driven Persona (minimum facts, trigger-only follow-ups, time budget) 🔴

### User Story 22.1
**As a caller in danger, I want Mia to ask only what responders need, in an order that fits my situation, so that the call is short and doesn't break the disguise.**
- [x] Replace the fixed step list in `persona.ts` with goals: minimum facts (exact location, what's happening, immediate danger), trigger-only follow-ups (spec §1.2), "never ask" rules, and a stop condition
- [x] **Always ask exact location**, even with good GPS: building/floor/flat when staying put; landmark + direction when moving (replaces Step 7's skip-when-moving)
- [x] Remove the "aim for at least 4 follow-ups" rule
- [x] Keep the fixed guardrails: code meanings unchanged, meaning stated in the same sentence, nothing alarming aloud in covert mode

### User Story 22.2
**As Mia, I want a live summary of what's already known, so that I never ask about something the camera, audio or caller has already told us.**
- [x] `liveSession.ts` (web **and native**) sends a "Known: … Still needed: …" system note after each tool call and each scene/sound observation

### User Story 22.3
**As a responder, I want the suspect's number plate captured, so that police can trace the vehicle.**
- [x] Persona asks for a plate (open mode) only when a vehicle is involved; camera prompt reads any visible plate
- [x] `vehicleNumber { value, confidence, source }` + `vehicleRegion` in `extractedFieldsLive` (agree with Person B)
- [x] Offline RTO-prefix decode (e.g. `KL-04` → Alappuzha). **No owner lookup**: owner details stay with VAHAN and authorised agencies

### User Story 22.4
**As a caller, I want the call to end naturally within about 3 minutes unless I'm on the move, so that the "order call" never outlasts its disguise.**
- [x] Persona time budget: critical facts ≤ 60–90 s; start wrapping up at ~2:30 unless the caller is moving/chased or a responder is guiding; never hang up automatically on a caller in danger
- [ ] Check that the order-placed screen keeps sending location while it's open

### User Story 22.5 (Person B)
**As a responder, I want the critical facts at the top of the incident page, so that I can act without hunting.**
- [x] Critical-info strip (where, what, weapon, how many, suspect, plate) filling in live
- [x] Completeness meter ("4 of 6 critical facts known")
- [x] Call timer turns amber at 3:00
- [ ] Rehearsal: 5 scenarios (chased, trapped, hurt, third party, open mode). Location never skipped, no repeated questions, nothing asked that camera/audio already answered, ≤ 3 min unless moving

## EPIC 23 — Responder → Caller Covert Messaging 🔴 (promotes 21.2)

### User Story 23.1
**As a responder, I want to send the caller a short instruction through Mia, so that I can guide them without breaking the disguise.**
- [x] (Person B) "Message caller via Mia" box with quick buttons + free text on the live incident page; `incidents/{id}/messages` + rules (signed-in responders only, status forward-only)
- [x] `liveSession.ts` (web **and native**) listens and injects each message as a system note on Mia's next turn, never interrupting the caller
- [x] Persona rewords it as delivery chat and calls `confirm_message_delivered { spokenAs }`; delivers only the safe part of anything that can't be disguised
- [x] (Person B) "✓ Delivered" + the exact wording Mia used, shown on the dashboard

## EPIC 24 — Coercion Detection 🟡 (promotes 21.1)

### User Story 24.1
**As a responder, I want to know when the caller may be speaking under someone else's control, so that a forced "cancel" doesn't close a real emergency.**
- [ ] Prototype first with a staged second-voice test call; cut the feature if detection is unreliable
- [x] Persona listens for voice change, flat or scripted tone, whispered asides, someone else answering, and never reacts aloud
- [x] `report_coercion_signal { kind, detail, confidence }` tool → incident field
- [x] (Person B) "Possible coercion" flag in the timeline; high confidence raises severity; "cancel" after danger signals keeps the incident open

## EPIC 25 — Hidden Demo Call 🔴

### User Story 25.1
**As a judge or tester, I want to try a real call without alerting responders, so that I can see the product working safely.**
- [x] Long-press (~2 s) on the QuickBite logo in the top bar starts a demo call; a short press does nothing unusual; the heart double-tap stays the silent SOS. Add the same to native Home
- [x] Full real call flow, but written to a separate `demoIncidents` collection with `isDemo: true` (own rules)
- [x] (Person B) Live queue, history, analytics, AI insights, alerts and sirens never read `demoIncidents`
- [x] End-of-call "What the responder would see" card on the phone (facts, severity, voice stress, transcript)
- [x] Light per-device limit (e.g. 3/hour) to protect Gemini quota; document the gesture in the README and deck

## EPIC 26 — Impact Analytics: BigQuery Sandbox + Looker Studio 🟢 (Person B)

### User Story 26.1
**As a judge or partner organisation, I want a public view of incident patterns and response times, so that the impact is measurable.**
- [x] `npm run export:bq` local script: anonymised table (~1 km grid cell, hour, weekday, severity, channel, danger categories, time to acknowledge/resolve). No names, notes, transcripts, addresses or plates
- [ ] Load into the BigQuery sandbox (free, no billing)
- [ ] Public Looker Studio report (area, hour/day, response-time trend, channel mix), linked from the landing page and deck

## EPIC 27 — Firebase AI Logic + App Check ⏸️ ON HOLD

- [ ] Move all Gemini calls off public `VITE_GEMINI_*` keys onto Firebase AI Logic, with App Check enforced
- [ ] Stopgap until then: restrict each key to the Generative Language API + the app's HTTP referrers in Google Cloud Console
