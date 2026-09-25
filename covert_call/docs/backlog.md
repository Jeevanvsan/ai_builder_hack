# QuickBite Backlog — Epics, User Stories, Sub-tasks

Derived from `docs/quickbite_plan.md` (authoritative plan — refer there for full rationale on any item). Ordered roughly by build sequence (Week 1 → Week 4 → stretch goals), not by epic number.

**Legend**: 🔴 Core (non-negotiable) · 🟡 Strong (second AI layer / dashboard) · 🟢 Stretch (only if time remains)

**Status (2026-09-25):** Epic 4 done and live at https://quickbite-5cde0-dashboard.web.app. Epics 1, 2 and 3 are now built end-to-end on branch `epic-1-2-3-gemini-live` (picked up by Jeevan while Ameen was busy — not yet merged, pending Ameen's review): the disguised Gemini Live call flow, silent-tap mode, structured extraction, voice stress, leakage check, and post-call consolidation (built client-side, not blocked on backend billing as originally scoped). Deployed live to https://quickbite-5cde0.web.app. Remaining open items in Epic 1/2: the "call ever mistakes itself for a literal food order" rehearsal check, and further live-call rehearsal of the persona's investigative depth. Epic 7.1 dashboard side done and tested with the dev camera (free P2P video); the real sender needs Person A's native app. Epics 5 and 6 not started.

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

- [ ] Confirm both QuickBite web app and Monitoring Dashboard are deployed and stable on Cloud Run/Firebase — dashboard live and stable; web app live at https://quickbite-5cde0.web.app but its code isn't in this repo yet
- [ ] Deployment hardening pass (no broken states, no dev-only debug UI left visible)
- [x] Tighten `dashboard/firestore.rules` before the link goes to judges — no deletes, only known fields with valid values, status only moves forward (resolved never reopens), ended calls never go live again, notes/stress history append-only, video handshake docs restricted. Verified allow/deny cases on the Firestore emulator. Still no sign-in: real access control needs Firebase Auth
- [ ] Verify the deployed link works end-to-end shortly before submission, not just once in Week 1

### User Story 5.2

**As the team, we need a 3-minute video that convincingly shows the mechanism working, so that judges understand the idea without reading documentation.**

- [ ] Script the demo around the real-time live-update moment (split-screen: disguised call on one device, dashboard populating live on another)
- [ ] Record and edit the video
- [ ] Rehearse the live-call persona flow end-to-end to catch any failure (e.g., persona misreading the disguised call as literal) before recording

### User Story 5.3

**As the team, we need a public GitHub repo and a solution deck, so that we meet the remaining mandatory deliverables.**

- [ ] Clean up repo: README, clear setup instructions, no secrets committed
- [ ] Build the solution deck, including the Google stack table (§5a) and competitive-honesty framing (§8)
- [ ] Decide and write the team's actual answer to "why this project fits Sustainability & Social Impact" (Problem Alignment & Impact is 25% of scoring, currently unresolved per plan §10 — resolve before finalizing the deck, not during Q&A)

---

## EPIC 6 — Stretch: Offline Mesh Relay 🟢

*Only attempt after Epics 1–4 are solid. Reuses infrastructure already designed for the deferred full-platform plan.*

### User Story 6.1

**As a person with no connectivity, I want my silent report to still reach a responder eventually, so that being offline doesn't mean my report goes nowhere.**

- [ ] Add photo/free-text attachment option to the silent tap-only screen
- [ ] Integrate Gemini vision to analyze attached photos into structured signal
- [ ] Implement single-hop Bluetooth mesh relay: queue locally when offline, relay to a nearby connected device, forward to backend
- [ ] Test the relay path end-to-end with two physical devices

---

## EPIC 7 — Stretch: Back-Camera Video 🟢

*Mobile app only, back camera only, never front. Two independent sub-goals — neither gates the other. Only attempt after Epic 6.*

### User Story 7.1 (Sub-goal A)

**As a responder, I want to watch a live video feed from the reporter's back camera like a video call, so that I have direct visual context, not just text.**

- [x] Evaluate and integrate a managed WebRTC/signaling service (e.g. LiveKit) — do not build signaling from scratch — decided instead: free peer-to-peer WebRTC with Firestore carrying the handshake (managed services need a token server, which needs billing). `shared/video/`
- [ ] Implement back-camera capture on the React Native app, streamed via the signaling service — call `startVideoPublisher()` from `shared/video/publisher.ts` (Person A)
- [x] Build the Live Video page on the Monitoring Dashboard (embedded live video player) — medium live-video box in the right column of the incident page + Full screen button to `/incident/:id/video`; connecting / live (only once media flows) / couldn't-connect (retry) / feed lost / ended states. Sender heartbeat every 10s so a feed whose sender vanished shows "Camera feed lost" instead of hanging. Dev test sender at `/dev/camera` (not linked in the UI)
- [ ] Verify: no flash, no shutter sound, no visible preview on the sender's screen (acknowledge the OS-level camera-in-use indicator as an unavoidable, disclosed limitation — do not claim full invisibility)

### User Story 7.2 (Sub-goal B)

**As a responder, I want Gemini to tell me what's visible in the camera feed as structured signal, so that I get AI-assisted context even without watching video myself.**

- [ ] Implement periodic still-frame capture (~1/sec) from the back camera, independent of Sub-goal A's video pipeline
- [ ] Send frames through Gemini Live's video input, in parallel with the existing audio session
- [ ] Implement session-resumption/reconnect handling for the 2-minute video-attached session cap
- [ ] Extract structured signal (e.g. "multiple people visible," "object consistent with weapon description") into the incident record — not rendered as its own raw-video UI

---

## Notes for using this backlog

- **Epics 1, 3, and 5 are the non-negotiable core** — if the 4 weeks run short, everything else (Epics 2, 4-partial, 6, 7) is where scope gets cut first, per the plan's own priority tiers.
- Epic 4 (Dashboard) got real scope in a later planning pass — don't under-budget it as "just wire up the data feed."
- Epics 6 and 7 are explicitly sequential stretch goals (7 only after 6), and within Epic 7, stories 7.1 and 7.2 are parallel, not sequential.
