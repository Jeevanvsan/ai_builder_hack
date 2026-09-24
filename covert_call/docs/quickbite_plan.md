# QuickBite Build Plan (Covert Call)

**This is the authoritative, current plan for QuickBite** — supersedes `standalone_covert_call_plan.md` in this same folder, which is kept for history but should not be treated as current. This doc reflects every correction and decision made through planning discussion, in one place.

**Scope reminder**: this is a 4-week hackathon prototype, not an enterprise/production product. Every decision below is sized for "works convincingly in a live demo and a 3-minute video," not production hardening.

## 1. What QuickBite is

A mobile/web app disguised as an ordinary food-delivery app. A person under direct observation or coercion (someone watching them, monitoring their phone) uses it to covertly summon help without the disguise being detected.

**Two interaction modes:**
- **Live call mode**: person taps "call for delivery confirmation." Gemini Live API answers in a natural voice, playing a restaurant-employee persona, having a genuinely adaptive conversation. Simultaneously extracts structured emergency data and analyzes vocal stress/tone.
- **Silent tap-only mode**: for no-connectivity or no-safe-sound situations. An ordinary-looking menu UI; long-pressing any element reveals (via a tooltip styled like a normal app hint) what it actually captures.

**The one inviolable design rule**: nobody needs to memorize anything in advance. Every coded question in live-call mode states its real meaning in the same breath it's asked — e.g. *"just confirming, if you need extra hot sauce say so and I'll add it"* secretly means *"say this if a weapon is present,"* explained live, not pre-agreed. No exceptions, ever — this was corrected twice during design (see §6) after the rule was accidentally violated in draft examples.

## 2. Threat model — QuickBite is IDENTIFIED, not anonymous

**Important, previously-corrected distinction**: QuickBite/Covert Call is the same threat model as an SOS system — the person needs a responder to know where/who to send help to. It is NOT the anonymous-whistleblower threat model (that's a separate, deferred concept called "Covert Notice" — identity never captured, adversarial re-identification testing, k-shield anonymity warnings). **Do not apply anonymity-protecting features to QuickBite** — a feature warning the user "you might be identifiable" or verifying a report "can't be traced back" is actively contradictory to QuickBite's purpose. Those concepts only apply if/when a separate anonymous whistleblowing product gets built later — see project memory for the full reasoning.

## 3. Why the bare mechanism alone isn't enough (and what closes the gap)

A single clever disguised-conversation trick, however impressive, reads to a judge as "one feature," not "a system." Scored against the hackathon's own weighting (40% technical merit, 25% originality), QuickBite needs real depth around the core mechanism:

- **Technical merit** needs multiple distinct AI reasoning steps, not one
- **Originality** needs to be honestly earned — competitive research confirms the *combination* (disguise + live in-breath code-teaching + real-time extraction) is unclaimed, but the surrounding system needs to justify itself too
- **Completeness** — stopping at "report received" reads as a tech demo, not a product; there needs to be a visible "what happens after"

## 4. Finalized feature set

### Core mechanism (non-negotiable)
- Live disguised conversation (Gemini Live API) — persona-driven, adaptive, every coded question self-explaining
- Silent tap-only fallback mode — long-press reveals real meaning, free-text search bar for flexible input
- Structured extraction — Gemini turns conversation/taps into a real structured report (people present, danger indicators, urgency, location)
- Universal zero-trace exit gesture — instant, no confirmation, no visible difference between "report sent" and "backed out"

### Second AI reasoning layer
- **Voice stress/duress detection** (Gemini Live native audio — pitch/pace/tone, not just transcription) — feeds urgency scoring. A headline capability, not a footnote — it's a second distinct AI reasoning output from the same Live API call.
- **Post-extraction leakage check** — a second Gemini pass reviews the extracted report before it reaches the responder, checking whether the conversation content inadvertently exposes OTHER people mentioned who didn't consent (a named bystander, a child) — flags for redaction. A genuine second-agent-pass architecture, distinct from extraction itself.

### Real-time response (the strongest demo moment)
- **Live field-by-field dashboard streaming during the call**: as Gemini extracts each field, it's written to the incident's Firestore document and reaches the dashboard immediately via Firestore real-time listeners — not batched until the call ends. A judge watches the disguised call happen on one screen while real incident details populate live on another.
- **Dashboard alert at call START**, not call-end or extraction-complete — the incident document is created and the dashboard notified the instant the disguised interaction begins, before any details are known yet.
- **Two-stage location flow, scoped to the dashboard** (this is a prototype — "notification" means the dashboard's incident card updates, not integration with real-world patrol/field units or emergency services):
  1. **Rough, instant**: device GPS/browser geolocation captured the moment the call starts (plain device capability, not AI) → dashboard shows an immediate alert with an approximate pin.
  2. **Precise, live**: Gemini's "delivery address" coded question gets the person's own spoken description of exactly where they are → refines the pin to a confirmed address, live, on the same dashboard.
  3. **Fallback for non-GPS devices** (laptop/PC — see §5 on why both web and native matter): coarse IP-based location lookup when device GPS is unavailable/denied. Matters less in practice since the realistic QuickBite user is on a phone, but avoids a silent failure.
  4. **Google Maps JavaScript API** renders the dashboard pin (the dashboard falls back to free OpenStreetMap tiles automatically when no Maps key is configured, since Google Maps requires a billing account); **Geocoding API** converts coordinates to a readable address. Comfortably free at prototype scale (see §7 cost estimate).
- **Post-call consolidation**: once the call ends, a separate Gemini pass writes one coherent incident summary (dispatcher-style case notes) from the full transcript, extracted fields, voice-stress trend, and leakage-check result — replacing the live field-by-field working state with a permanent case record.

### The Monitoring Dashboard — a separate, dedicated web app (not a phone-sized view)

**Important correction**: the dashboard is NOT a scaled-down companion screen to QuickBite — it's its own, entirely separately hosted web application, designed for a large monitor/operations-center display, not a phone. QuickBite (the disguise) and the Monitoring Dashboard (the responder side) are two independent products sharing only the backend/data layer — different repos or at minimum different deployed apps, different design language (QuickBite must look like a consumer food app; the dashboard should look like a real operations tool), different target device (phone vs. big screen).

**Dashboard tech**: plain React (Vite), same framework family as QuickBite's own web app now that both are React rather than Next.js. The dashboard is a real-time, client-heavy app reading and writing Firestore directly with no SEO or server-rendering need, so Next.js's SSR/routing/API-route features were never a meaningful fit here. Still deploys to Cloud Run or Firebase Hosting like any static/SPA build, satisfying the same mandatory live-link requirement.

**Dashboard feature set**:
- **Real-time incident notifications** — new incidents appear the instant a call/session starts, with audible/visual alerting appropriate to an operations-center context (not just a quiet UI update)
- **Live incident view** — the field-by-field streaming during an active call, as already designed
- **Consolidated case reports** — the post-call summary, permanently browsable, not just a transient live state
- **Case list / queue view** — multiple incidents, severity-sorted, built for scanning at a glance on a large display (this is the piece most obviously wrong at phone size — a triage queue needs a wide, multi-column layout, not a single stacked card)
- **Action/response tracking** — responder marks an incident as acknowledged / in-progress / resolved, with that state change reflected back (this is new scope, not previously detailed — needs its own data model fields, e.g. `status`, `acknowledgedBy`, `acknowledgedAt`, `resolvedAt`, and a UI for a responder to actually take these actions, not just view read-only data)

**Why this matters for the build**: this changes the dashboard from "a page that shows one incident" to "a real, small ops tool" — still sized for a 4-week hackathon prototype (a handful of screens: live queue, incident detail, case history), but it's meaningfully more than a websocket-subscribed div. Budget real Week 3-4 time for this, not an afterthought bolted onto the QuickBite build.

**Visual theme: light theme, not dark.** Explicit decision — the dashboard's "operations tool" feel does NOT mean the common dark, control-room-style dashboard look. Build it light-themed (light background, dark text) to match QuickBite's own light UI and keep both products visually coherent as one system, rather than defaulting to a dark ops-console aesthetic. (Checked the diagrams artifact mock: its actual dashboard content already uses theme-aware tokens and follows the viewer's light/dark setting correctly — the only hardcoded-dark elements are the literal monitor-bezel chrome and the mock video-feed placeholder, both intentionally dark regardless of app theme, same as a real monitor's physical frame. No fix needed there.)

### Stretch goal — image/text silent SOS with mesh relay (build only if core scope is solid and time remains)
- **Extends the silent tap-only mode**, not a new screen: add the ability to attach a photo (surroundings, an injury, the room) or free-text message to a silent-mode report, alongside the existing tap-based menu selections.
- **Gemini vision** analyzes the attached photo the same way the live-call mode extracts structured signal from conversation — same reasoning pattern, different input modality.
- **Bluetooth mesh relay (single-hop)**: if the device has no connectivity when the silent report is submitted, it queues locally and relays via Bluetooth to a nearby device that does have connectivity, which forwards to the backend. This directly closes a real gap in the current silent-mode design — right now a report submitted with zero connectivity just sits queued with nothing happening until connectivity returns; mesh relay actually moves it while still offline, using the exact same disguised interface (still silent, still looks like a food app).
- **Why this is a stretch goal, not core**: it reuses infrastructure already designed in full for the deferred full-platform plan (see `docs/implementation_plan.md` at the repo root for the original mesh relay design) — nothing new to invent, just importable if Week 3-4 time allows after the core mechanism (§4) is solid. Does not change QuickBite's threat model (§2) — still identified, not anonymous.
- **Sequencing**: only attempt this after the core live-call + silent tap-only mechanism, real-time dashboard streaming, and location flow are all working reliably. It's an addition on top of a proven base, not a parallel build track.

### Stretch goal — back-camera video, mobile app only (TWO INDEPENDENT sub-goals, neither gates the other)

User's explicit requirement: both of the following are wanted, and **neither is a prerequisite for the other** — if Gemini frame-analysis isn't built in time, live video-to-dashboard should still ship on its own, and vice versa. Treat these as two separate, parallel stretch efforts, not one feature with a sub-extension.

**What "silent" means here, precisely (applies to both sub-goals)**: no flash, no shutter sound, no visible camera preview shown to the QuickBite user — all genuinely achievable, since none of that is inherent to programmatic camera capture (it's a courtesy behavior of dedicated photo-taking UIs, not something this pipeline triggers). **What cannot be avoided, on any platform**: the OS/browser itself shows a small camera-in-use indicator (Android's camera-access indicator, iOS's green dot, a browser tab icon) the instant a camera activates — a deliberate, non-suppressible security feature that exists specifically to prevent covert camera use by any app. State this plainly, don't gloss over it.

**Mobile app only, not the web build** — scoped to the React Native app. **Back camera only, never front** — capturing the reporter's own face adds real risk (a photo tying their face to the incident) with no offsetting safety benefit.

#### Sub-goal A — live video streamed to the Monitoring Dashboard, like a video call
- A responder watches **continuous, real-time video** on the dashboard during an active QuickBite call, not just text signal or periodic stills.
- **This is architecturally a video-calling problem (WebRTC-class), separate from anything Gemini does** — needs its own infrastructure: a signaling/session layer and peer connection handling (e.g. via a managed service like LiveKit or a comparable WebRTC provider, rather than building a signaling server from scratch in 4 weeks) delivering the back-camera feed to the dashboard's incident detail view as an embedded live video player.
- **Genuinely new infrastructure, not a reuse of anything already planned** — this is the single biggest addition to the stretch-goal tier. Budget real time for it if attempted; don't assume it's a small add-on.
- Independent of Gemini entirely — this can ship even if the analysis sub-goal below is never built.

#### Sub-goal B — Gemini analyzes the same feed into structured signal
- Runs in parallel off the same camera, sampled as periodic still frames (Gemini Live's actual mechanism — confirmed via research it processes video as ~1 frame/sec, tokenized individually, not true continuous video; avoid overclaiming "live video analysis" in the pitch for this reason).
- Session constraint: attaching video to a Gemini Live session drops the cap from 15 minutes (audio-only) to 2 minutes — needs reconnect/session-resumption handling to sustain a longer call, confirmed via research.
- Output is structured signal into the incident record (e.g. "multiple people visible," "object consistent with a weapon description"), same pattern as every other extraction in this app — not something rendered as its own UI.
- Independent of the live-video-to-dashboard sub-goal — can ship, or not, regardless of Sub-goal A's status.

**Sequencing**: both remain the outermost stretch tier — attempt only after the core mechanism (§4) and the mesh/photo stretch goal above are solid. Given Sub-goal A's real infrastructure cost, treat it as the harder of the two to actually land in 4 weeks; scope expectations accordingly rather than assuming both ship.

### Explicitly deferred (not part of QuickBite's scope — belong to the separate, deferred Covert Notice/full-platform concept)
- Anonymous whistleblowing pipeline (anonymization, adversarial re-identification, k-shield, clustering, satellite corroboration, crypto proof) — wrong threat model for QuickBite, see §2
- Cross-case clustering / entity linking over time — no case load to cluster, only individual incidents
- SOS fall/crash detection (TFLite classifier, Gemma alert-gen), Blind Relay (mesh privacy layer), Android Private Space — still deferred; genuinely not required for QuickBite even with the mesh stretch goal above, and add real build complexity beyond it
- SynthID evidence-photo screening — no dedicated photo-evidence pipeline in this scope (the stretch-goal photo attachment above is analyzed by Gemini vision for content, not screened for AI-generation)

## 5. Tech stack

**Build both a web app and a native app.** QuickBite's core mechanism needs no native sensors or Bluetooth — Gemini Live runs over a standard WebSocket, which works fine from a browser via the Web Audio/microphone API. This is a real simplification versus assuming everything needs React Native.

- **QuickBite web app** (plain React/Vite, Cloud Run/Firebase) — the primary build. Disguised ordering UI, Gemini Live integration via WebSocket from the browser, structured extraction, leakage-check pass. Satisfies the mandatory deployed-link requirement directly, fastest to build, and arguably a MORE convincing disguise than a native app (zero install footprint — just a browser tab). Plain React over Next.js since the app is a client-heavy disguise UI + WebSocket session with no SEO/server-rendering need.
- **QuickBite native app** (React Native) — built after the web version is proven, for a more convincing "real app" demo feel and to keep the door open for future sensor/mesh features.
- **Backend** (Cloud Run, FastAPI or Node) — shared by QuickBite (web + native) and the Monitoring Dashboard. Receives streamed partial updates + final consolidated reports and writes them to Firestore. **Real-time channel to the dashboard = Firestore real-time listeners** (decided during Story 4.3): the dashboard subscribes to the `incidents` collection directly, so there is no custom WebSocket/SSE server to build or keep alive on Cloud Run.
- **Monitoring Dashboard — a separate, dedicated web app** (plain React/Vite, own Cloud Run/Firebase deployment, own repo or at minimum own deployed URL) — built for a **response team**, on a large monitor/operations-center display, not a phone. This is the mandatory live-clickable deliverable. Multiple team members may view/act on it at once — hence the action/response tracking (acknowledged/in-progress/resolved) in the feature set above, and why `Identity Platform / Firebase Auth` (see §5a extensible additions) becomes more plausible here than originally assessed, if there's a real need to know *which* responder acknowledged/resolved an incident. Subscribes to the same real-time channel as QuickBite writes to.
- **Gen AI**: Gemini Live API (persona conversation + native audio + incremental function-calling for mid-call extraction), Gemini structured output (post-call consolidation + leakage-check passes)
- **Location**: device GPS/browser geolocation + IP-based fallback; Google Maps JavaScript API (dashboard pin) + Geocoding API (readable address); refined via conversation

**Build order**: web app first (de-risks the core Gemini Live mechanism fastest, satisfies the mandatory deliverable), then port to React Native once proven — don't build both from scratch in parallel.

## 5a. Google stack — core (in the current plan) vs. proposed extensible additions

**Core Google stack (already in the plan above, this is a consolidated reference):**

| Layer | Google product | Role in QuickBite |
|---|---|---|
| Conversational AI | **Gemini Live API** | The disguised persona conversation — real-time voice, native audio (stress/tone), incremental function-calling for live extraction |
| Structured AI reasoning | **Gemini API** (text/structured output) | Post-call consolidation pass, leakage-check pass |
| Compute / hosting | **Cloud Run** | Backend API (writes incident updates to Firestore) |
| Hosting (alt.) | **Firebase Hosting** | Alternative/complement to Cloud Run for the web app + dashboard static assets |
| Database | **Firestore** | Incident documents, live field updates, consolidated case records |
| Maps | **Google Maps JavaScript API** | Responder dashboard location pin |
| Geocoding | **Google Maps Geocoding API** | Raw GPS coordinates → readable address |
| Dev tooling | **Google AI Studio** | Free-tier API keys for development/testing (see cost estimate, §7) |

This set alone satisfies the hackathon's mandatory-tech requirement (Gemini + Cloud Run/Firebase) and is sufficient to build everything in §4.

**Proposed extensible additions — not required, but worth having ready to mention as "designed to extend into the Google stack" in the deck, or to actually add if time allows:**

| Google product | What it would add | Why it's optional/extensible rather than core |
|---|---|---|
| **Vertex AI** (vs. plain Gemini API/AI Studio) | Production-grade quota, IAM/VPC controls, model tuning | Not needed at hackathon-prototype scale — AI Studio's free tier is sufficient and simpler; worth naming in the deck as "the natural upgrade path for a real deployment" |
| **Grounding with Google Maps** (a Gemini API tool, distinct from the Maps JS/Geocoding APIs already in use) | Lets Gemini cross-check a claimed location/business against real Maps place data inside the same API call, as a plausibility signal | More relevant to the deferred Covert Notice concept (verifying whistleblower claims) than to QuickBite's location capture, which is already handled directly by GPS + conversation. Worth a one-line mention as a natural extension, not core |
| **SynthID Detector** | Screening any future photo/video evidence upload for AI-generation | QuickBite currently has no evidence-photo upload path — relevant only if that feature is added later |
| **Gemini 3 / Gemini 4 Flash** (model upgrade) | Newer, more capable models as they roll out | Not a build decision now — just keep the model choice easily swappable in config, don't hardcode a specific model version deep in the code |
| **Cloud Logging / Cloud Monitoring** | Observability into the real-time pipeline (useful for debugging the incident write path during Week 3 build) | A genuinely useful *development* tool, not a demo-facing feature — worth using informally during build, not something to present to judges as a feature |
| **Identity Platform / Firebase Auth** | If the responder dashboard needs real login instead of an open/demo URL | Only needed if multiple responders with distinct accounts becomes a real requirement; a single shared demo view is fine for a hackathon |
| **Google Cloud Text-to-Speech / Speech-to-Text** (standalone, outside Gemini Live) | Alternative if Gemini Live's native audio proves difficult to integrate in the time available | A fallback path, not a primary plan — Gemini Live's integrated approach is strictly better (native tone/stress analysis) if it works; keep this as a "Plan B" mentally, not something to build in parallel |

**How to use this in the deck**: presenting the core stack table shows meaningful, correctly-scoped Gen AI use (the 40% criterion). Mentioning 2-3 of the extensible additions (Vertex AI as the production upgrade path, Grounding with Maps as a natural extension) signals platform fluency and forward-thinking architecture without overclaiming features that weren't actually built — consistent with the project's existing honesty pattern (see `docs/prototype_build_plan.md` §5a/§5b for the same approach used elsewhere).

## 5b. Data model

**`incidents`** (Firestore) — one document per QuickBite session, written by the backend, read/updated by the Monitoring Dashboard

```
{
  id, sessionStartedAt, sessionEndedAt,
  channel: "live-call" | "silent-tap" | "auto-sos" (if fall detection kept),
  callState: "active" | "ended",

  location: {
    rough: { lat, lng, source: "gps" | "ip-fallback", capturedAt },
    confirmed: { address, lat, lng, confidence, confirmedAt } | null
  },

  extractedFieldsLive: { peopleCount, dangerIndicators, urgency, notes },
  consolidatedSummary: string | null,
  fieldConfidence: { [fieldName]: "confirmed" | "inferred" | "uncertain" },
  transcriptSummary,
  voiceStressScore, voiceStressTrend: [{ timestamp, score }],
  leakageCheckStatus: { reviewed: bool, redactions: [...] },

  severity: "low" | "medium" | "high",

  response: {
    status: "new" | "acknowledged" | "in_progress" | "resolved",
    acknowledgedBy: responderId | null,
    acknowledgedAt: timestamp | null,
    resolvedAt: timestamp | null,
    notes: [{ responderId, text, at }]
  }
}
```

The `response` block is new scope from the "separate dashboard for a response team" correction (see below) — it didn't exist when the dashboard was still being treated as a single-viewer live-update panel. It's what makes action/response tracking real: a responder can claim an incident, and that state is visible to the rest of the team immediately over the same real-time channel.

## 6. Design corrections made during planning (do not regress on these)

1. **No prior memorization, no exceptions.** Every coded question must state its real meaning in the same breath it's asked. Caught twice during design — an early draft question stated the cover story but not the real meaning, reintroducing the exact flaw the live-teaching rule was meant to solve.
2. **Silent mode reveals meaning via long-press**, not at-a-glance text, not a separate tutorial.
3. **The tap-button mapping itself is plain app logic, not Gen AI** — be precise about this in the deck so the AI claim isn't oversold. The real Gen AI is in the conversation, the extraction, the stress detection, and the leakage-check pass.
4. **Gemini Live API has no offline mode** — QuickBite's live-call mode requires connectivity; falls back to silent tap-only mode when offline.
5. **k-shield and adversarial re-identification do NOT apply to QuickBite** (see §2) — this was an early scoping error, corrected directly by the user.
6. **"Notify nearby team" was corrected to "alert the responder dashboard"** — this is a prototype, not a real dispatch integration. All "notification" language refers to the dashboard's live incident card, not real-world patrol/field units.
7. **Prototype scope, not enterprise/production**: app-store distribution policy, formal test-suite mandates, and production-grade hardening are out of scope unless asked for. A quick sanity-check while rehearsing the demo (e.g. does the persona ever mistake the disguised call for a real order — a documented failure mode in the real AI-911-dispatch industry) is sufficient; this is demo prep, not a formal requirement.
8. **The Monitoring Dashboard is a separate web app for a response team, not a phone-sized panel.** Earlier mock UI and planning language treated it as a small live-update view; corrected to: its own deployment, designed for a large monitor/ops-center display, with a real case queue (multiple incidents, not one), action/response tracking (acknowledge/in-progress/resolve, per §5b's `response` block), and audible/visual alerting appropriate for a team monitoring it together, not a quiet single-viewer UI update.

## 7. Cost estimate (hackathon prototype scale)

**Rough total for 4 weeks: ₹0–₹1,450 (~$0–$15).**

| Service | Cost |
|---|---|
| Gemini Live API (voice conversation) | ~₹5–8 per 2-3 min test call; free tier via Google AI Studio covers most dev/testing |
| Gemini structured output (extraction, consolidation, leakage-check) | ~₹0 — free tier covers dozens–hundreds of calls |
| Cloud Run, Firebase Hosting, Firestore | ₹0 — hackathon-scale usage stays well within free tiers |
| Google Maps JS + Geocoding API | ₹0 — covered by Maps Platform's free monthly credit at this scale |

The only real cost exposure is Gemini Live voice-session testing if many back-to-back live calls are run in a single day and exceed free-tier rate limits — budget a small buffer, not a real concern otherwise.

**Note**: the hackathon's public pages (FAQ, homepage, themes) do not confirm any provided Google Cloud credits or API keys for participants — worth asking organizers directly (Discord/email) once registered, but don't assume it's provided.

## 8. Competitive verification (confirmed unclaimed, two research passes)

Two separate, deliberately adversarial research passes (not just confirming assumptions) searched for any existing product combining: a disguised persona conversation + live in-breath code-teaching + real-time structured extraction + mid-call dashboard streaming. **Verdict both times: fully unclaimed.** Closest cousin found: "Guardian AI" (a Gemini Live Agent Challenge hackathon project) — same underlying real-time voice tech, but an overt always-visible monitor, not a disguised two-way deceptive persona. No shipped app, patent, academic paper, or hackathon project combines the full mechanism.

One practical demo-prep note from that research: real AI-911-dispatch companies (Aurelian, Hyper, Carbyne) have flagged that a naive AI can take a "pizza order" call literally and just process it as a real order, missing the disguise's purpose entirely — worth a quick sanity check while writing the persona prompt and rehearsing, not a formal requirement (see §6.7).

## 9. 4-week schedule

**Week 1 — Foundation**
- Repo scaffolding: **QuickBite web app, backend, native app skeleton, AND the Monitoring Dashboard as its own separate app/repo** — do not fold the dashboard into the QuickBite frontend project
- Deploy skeleton QuickBite web app AND skeleton Dashboard live on Cloud Run/Firebase day 1-2 (mandatory deliverable, de-risk early)
- Disguised ordering UI: menu, cart, checkout flow — visual polish matters heavily, disguise realism is the entire premise
- Backend: endpoint + minimal data model (§5b)
- Device GPS/geolocation capture wired to incident creation

**Week 2 — Core Gen AI mechanism**
- Gemini Live API integration: persona/system-instruction design
- Structured extraction via function calling
- **Strict build/test rule**: every coded question must state its real meaning in the same breath — write test transcripts and review each one against this rule before building further
- Voice stress/duress detection wired into the same Live API call
- Silent tap-only mode: menu UI with long-press reveal tooltips

**Week 3 — Real-time pipeline + second AI layer**
- Real-time channel between client and dashboard — Firestore real-time listeners (dashboard side already built in Story 4.3); the backend just writes incident updates to Firestore
- Wire incremental Gemini Live function-calling to push live field updates as they're produced, not batched at the end
- Incident document created + dashboard notified at call START
- Two-stage location flow: rough GPS pin instantly, precise address refined live via conversation; Google Maps integration for the dashboard pin
- Post-extraction leakage-check pass
- Universal zero-trace exit gesture

**Week 4 — Post-call consolidation + Dashboard build-out + polish**
- Post-call consolidation pass: coherent incident summary once the call ends
- **Monitoring Dashboard, built out as its own product** (not just wired to a data feed): live incident queue (multi-case, severity-sorted, big-screen layout), incident detail view (live-updating during an active call, transitioning to consolidated case record), action/response tracking UI (acknowledge / in-progress / resolve, per §5b's `response` block)
- Port proven QuickBite web mechanism to React Native
- End-to-end testing: disguise convincingness (role-play an overhearing bystander), dashboard updates genuinely arrive live during a call, response-status changes reflect back correctly
- Deck + 3-minute demo video — the real-time live-update moment is likely the strongest single shot: split-screen the disguised call on one device against the dashboard populating live on a separate (ideally larger) screen
- GitHub repo cleanup, deployment hardening
- **If time remains after the above is solid**: stretch goal — image/text attachment on the silent tap-only mode + single-hop Bluetooth mesh relay (see §4 stretch-goal section). Only attempt this last, on top of a fully working core; do not let it displace core-scope work or polish/demo prep.

## 10. Open questions (genuinely undecided, revisit if/when relevant)

- Whether/when to build back toward the full platform (Covert Notice anonymous pillar + SOS/mesh) once QuickBite is validated — explicitly deferred, not decided either way
- Theme-fit framing for the deck ("Sustainability & Social Impact" vs. QuickBite's personal-safety domain, and its proximity to Haven's actual DV domain) — still unresolved; no honest justification has been settled on yet, don't invent one
