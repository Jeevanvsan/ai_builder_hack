# Standalone Plan — "QuickBite" (Covert Call) as the Entire Prototype

**App name: QuickBite.** This is the actual product/repo/deck name — a deliberately generic, realistic food-delivery app name chosen specifically to maximize disguise realism (the whole premise depends on it looking like any other ordinary delivery app, not a safety product). "Covert Call" remains the internal/planning-doc name for the underlying mechanism; "QuickBite" is what appears in the UI, the deck, the GitHub repo, and the demo video.

**Status: current near-term build focus** (per the user's explicit decision — see project memory `project_hackathon_scope_decision_pending`). This doc, now living in `covert_call/docs/`, is the active build reference for QuickBite. The full-platform plan (`docs/prototype_build_plan.md` + `docs/implementation_plan.md`, at the repo root) remains the longer-term/eventual goal, not abandoned.

**Revision note**: the first version of this doc scoped a minimal/functional build. This revision answers a harder question — *if we commit to standalone, what's actually needed to WIN, not just to work?* A bare disguised-conversation trick alone is too thin to carry 40% technical-merit + 25% originality scoring alone. The feature set below is what closes that gap.

## 1. What this scope is

QuickBite as the entire product: a person opens what looks like an ordinary food-delivery app; underneath, Gemini either (a) holds a live disguised phone conversation or (b) reads silent tap-based input, extracts a real structured emergency report, and routes it to a responder. Full mechanism/safety design/citations are in `docs/prototype_build_plan.md` §4a (repo root).

## 2. Why the minimal version isn't enough to win (gap analysis)

Scored against the hackathon's own weighting:

- **Technical merit (40%)** — a single clever mechanism, however impressive, reads as "one feature" to a judge, not "a system." The full-platform plan's strength here came from *multiple* AI reasoning layers (anonymization, adversarial re-ID, clustering) working together. Standalone needs its own multi-layer depth, not just one trick.
- **Originality (25%)** — the full platform had TWO defensible claims (adversarial re-ID loop, shared dual-backbone architecture). Going standalone drops the second one entirely. It needs a replacement second claim, not just the one mechanism.
- **Completeness** — stopping at "report received by responder" reads as a tech demo, not a product. Needs a visible "what happens after" story.

## 3. Finalized feature set to include (this is what "winning standalone" requires)

### Tier 1 — the core mechanism (non-negotiable, this is the product)
- **Live disguised conversation** (Gemini Live API) — persona-driven, natural, adaptive; every coded question states its real meaning in the same breath, no exceptions (see `docs/prototype_build_plan.md` §4a for the strict rule and why it exists)
- **Silent tap-only fallback mode** — for no-connectivity or no-safe-sound situations; long-press reveals real meaning per element, free-text search bar for flexible input
- **Structured extraction** — Gemini turns conversation/taps into a real structured report (people present, danger indicators, urgency, location)
- **Universal zero-trace exit gesture** — instant, no confirmation, no visible state difference between "report sent" and "backed out"

### Tier 2 — second AI reasoning layer (closes the technical-merit gap)
- **Voice stress/duress detection** (Gemini Live native audio — pitch/pace/tone, not just transcription) — feeds directly into urgency scoring shown to the responder. This must be a headline piece here, not a footnote, since it's the second distinct AI reasoning capability alongside extraction itself, both from the same Live API call.
- **Post-extraction leakage check** — a second Gemini pass reviews the extracted report before it's stored/relayed, checking whether anything in the conversation content (not metadata — the report is already identified/opted-in by design, unlike Covert Notice) could inadvertently expose OTHER people mentioned who didn't consent (e.g. a named bystander, a child, a neighbor) — flagging those for redaction before the report reaches a responder. This is a genuine second-agent-pass architecture, distinct from the extraction step, and gives judges a second "AI reasoning over AI output" story to point to, structurally similar to the adversarial re-ID concept from the full plan but applied to a new problem (third-party exposure, not self-exposure) so it doesn't just feel like a copy-paste of the dropped feature.

### Tier 3 — second originality claim (replaces the lost shared-backbone story)
- **Blind Relay** (onion-style encrypted mesh hops + timing jitter, if offline/mesh capability is kept — see open question in §4) — a bystander relaying someone's Covert Call report can't be traced/located by an attacker watching mesh traffic. This is the strongest available replacement for the lost "two threat models, one backbone" originality claim: it's independently confirmed-novel (no consumer mesh SOS app solves this), and it's a second, separate technical claim from the disguised-conversation mechanism itself — so the standalone pitch still has two legs to stand on, not one.
- **Android Private Space integration** — the app hides inside Android's native hidden PIN-gated space, never appearing in the normal launcher/install list. Cheap, reinforces the exact same threat model Covert Call already assumes (someone's phone may be searched/checked), and adds a second concrete "we thought about real-world detection risk" point for the safety-design section of the deck.

### Tier 4 — real-time response + post-call consolidation (closes the completeness gap)

This tier has two distinct parts — a live, mid-call stream to the dashboard, and a clean summary once the call ends. Both matter: real-time speed is what makes this useful for an actual emergency (a responder shouldn't have to wait for the call to end before starting to act), and post-call consolidation is what makes the case usable afterward (a responder reviewing later needs a coherent write-up, not a raw field dump).

- **Real-time push during the call**: as Gemini extracts each field during the live conversation (people count confirmed, a danger indicator detected, voice stress spikes), that update is pushed to the dashboard **immediately, not batched until the call ends**. Technically: the mobile app streams partial structured-extraction results to the backend as they're produced (Gemini Live's function-calling can fire incrementally, mid-conversation, not only at the end), and the backend pushes them to the dashboard over a websocket/SSE connection, arriving as a live-updating incident card, not a static report. This is the single most demoable "wow" moment of the whole feature: a judge watches the disguised order happen, and in a separate window, sees the real incident details populate live, field by field, while the call is still in progress.
- **Responder notification on call start**: the moment Covert Call begins (not extraction complete, not call ended — the instant the disguised interaction starts), the dashboard gets an immediate alert so a responder is already watching before any details have even been extracted yet — critical for genuine time-sensitivity, since waiting for full extraction before alerting anyone defeats the purpose of "real-time."
- **Two-stage location flow (rough-then-precise) — scoped to the dashboard, not real-world dispatch**: (1) the moment the call starts, the device's GPS/browser location is captured immediately and attached to the incident — this is plain device location capability, not AI, instant and free — and the **responder dashboard shows an immediate alert with a pin at this approximate location**, before any conversation has happened; (2) as the live call continues, Gemini's "delivery address" coded question (already part of the persona's question set) gets the person's own spoken description of exactly where they are — street, landmark, floor, building — refining the rough GPS pin into a precise, confirmed address shown live on the same dashboard. This combines speed (dashboard alert instantly on rough location) with accuracy (refine to exact address via conversation), avoiding both failure modes of relying on either signal alone (GPS-only can be imprecise, especially on laptop/PC — see below; conversation-only would delay any alert until the call progresses far enough). **Note: this is a prototype, not a real dispatch system** — "notification" means the dashboard's incident card updates in real time, not an integration with actual patrol/field units or emergency services; see the standing prototype-scope reminder in CLAUDE.md.
- **Location fallback for non-phone devices**: since QuickBite is being built as both a web app and a native app (§5), browser-based GPS on a laptop/PC is far less precise than phone GPS (no GPS chip — relies on Wi-Fi/IP-based positioning) or may be unavailable if permission is denied. Fallback: use a coarse IP-based location lookup when device GPS isn't available, and always treat the live conversation's address confirmation as the ultimate precision source regardless of device — this matters less in practice since the realistic user (someone in immediate physical danger) is almost always on a phone, not a desktop, but the fallback avoids a silent failure if a laptop/PC session occurs.
- **Google Maps integration**: once coordinates exist (from GPS or the conversation-confirmed address), use the Google Maps JavaScript API to render a pin on the responder dashboard, and the Geocoding API to convert raw coordinates into a human-readable address. Comfortably covered by Google Maps Platform's free monthly credit at hackathon-prototype scale (see cost estimate discussion).
- **Post-call consolidation**: once the call ends (or the person exits), Gemini runs one more pass over everything gathered — the full transcript, all extracted fields, the voice-stress trend over the call, and the leakage-check result — and writes a single coherent incident summary (like real dispatcher case notes: what happened, who's involved, what's the danger, what's the location, what's the confidence level on each field) rather than leaving the responder to piece together a list of raw fields. This consolidated summary becomes the case's permanent record; the live field-by-field updates during the call are ephemeral/working state that gets replaced by this final version.
- **Responder view**: a live incident card during an active call (updating in real time per the above), transitioning to a consolidated case record once the call ends — plus the incoming report list, urgency/voice-stress indicator, location, and (if mesh kept) the relay hop trail
- **Minimal severity ordering**: reports sorted by urgency so the responder view reads as a real triage tool, not a raw log — reuses the same "severity scoring" concept from the full plan, scoped down to one feature instead of a cross-case system

### Explicitly cut (confirmed out of scope for this standalone plan)
- The whole Covert Notice environmental/labor whistleblowing pipeline (anonymization, adversarial re-ID *for self-exposure*, clustering, k-shield, satellite corroboration, crypto proof) — none of this applies without a separate whistleblowing channel
- Cross-case clustering / entity linking over time — there's no case load to cluster, only individual incidents
- SynthID evidence-photo screening — no photo-evidence submission path in this scope

## 4. Open scoping questions (still need a decision before building)

- **Manual SOS + fall/crash detection as a separate trigger path, alongside Covert Call?** Keeping it preserves the on-device Gemma alert-generation story (a third distinct, correctly-scoped Gen AI usage: TFLite classifies, Gemma narrates). Recommended to KEEP if team capacity allows — it's cheap relative to its technical-merit value (confirmed low phone-spec requirements, low build risk) and gives judges a third AI-reasoning example beyond conversation + stress detection.
- **Offline/mesh relay — keep or cut?** Directly gates whether Blind Relay (Tier 3) is buildable at all. Recommended to KEEP at minimum a single-hop version, since losing it also removes your second originality claim, leaving only one leg (the disguised conversation) to stand on.
- **Responder view scope** — a single incoming-report list + detail view is sufficient; does not need multi-case history, a map beyond one location pin, or long-term case tracking.

## 5. Tech stack

**Platform decision (revised): build BOTH a web app and a native app for QuickBite itself.** QuickBite's core mechanism (disguised ordering UI, Gemini Live conversation, structured extraction) does NOT require native sensors or Bluetooth mesh — Gemini Live runs over a standard WebSocket, which works fine from a browser via the Web Audio/microphone API. This is a genuine simplification versus the original SOS/mesh-driven assumption that everything had to be React Native.

- **QuickBite web app (Next.js, Cloud Run/Firebase)**: the primary build — disguised ordering UI, Gemini Live integration (conversation + native audio stress detection) via WebSocket from the browser, structured extraction, post-extraction leakage-check pass. Satisfies the mandatory deployed-link requirement directly (a web app IS the deployed link), fastest to build, and arguably a MORE convincing disguise than a native app — zero install footprint, no app icon ever exists, just a browser tab like any other food-delivery site.
- **QuickBite native app (React Native)**: built alongside, for demo purposes (a more convincing "real app" feel in the video/deck) and to keep the door open for SOS sensor/mesh features if the full platform resumes later. Same core mechanism as the web version, reusing the same backend.
- **Backend (Cloud Run, FastAPI or Node)**: shared by both web and native clients. Receives streamed partial updates + the final consolidated report, minimal data model, serves the responder view. **Needs a real-time channel to the dashboard** (websocket or Server-Sent Events) — a plain request/response API is not sufficient for the mid-call live-update requirement (Tier 4). Cloud Run supports long-lived websocket connections; confirm this during Week 1 setup rather than discovering a limitation late.
- **Responder view (Next.js, Cloud Run/Firebase)**: mandatory live-deployed-link deliverable. Subscribes to the real-time channel to render live-updating incident cards during an active call.
- **Gen AI**: Gemini Live API (persona conversation + native audio + incremental function-calling for mid-call field extraction), Gemini structured output (post-call consolidation pass + leakage-check pass). TFLite/Gemma 3 270M SOS path only relevant if that scope question (§4) is later revisited — not required for QuickBite's core mechanism.
- **Location**: device GPS/browser geolocation (captured instantly at call-start, not an AI feature) with an IP-based coarse fallback for non-GPS devices (laptop/PC); Google Maps JavaScript API for the responder dashboard pin + Geocoding API to convert coordinates to a readable address; refined to a precise address live via the conversation's "delivery address" coded question. See the two-stage location flow in Tier 4 above.

**Build order recommendation**: build the web app first (faster, de-risks the core Gemini Live mechanism early, satisfies the mandatory deliverable), then port the same mechanism to React Native once it's proven — don't build both from scratch in parallel.

## 6. Data model

**`covert_reports`** — one document per incident, created the instant a call/session starts (not when it ends), updated live as fields stream in, finalized once the post-call consolidation pass completes
```
{
  id, sessionStartedAt, sessionEndedAt,
  channel: "live-call" | "silent-tap" | "auto-sos" (if fall detection kept),
  callState: "active" | "ended",
  location: {
    rough: { lat, lng, source: "gps" | "ip-fallback", capturedAt },   // written instantly at session start, triggers nearby-team notification
    confirmed: { address, lat, lng, confidence, confirmedAt } | null   // written once the conversation's address question resolves; null until then
  },
  extractedFieldsLive: { peopleCount, dangerIndicators, urgency, notes }, // updated incrementally during the call (location now tracked separately above)
  consolidatedSummary: string | null,   // written once, by the post-call Gemini pass, null while callState = "active"
  fieldConfidence: { [fieldName]: "confirmed" | "inferred" | "uncertain" },  // from the consolidation pass
  transcriptSummary (if live-call mode),
  voiceStressScore, voiceStressTrend: [{ timestamp, score }] (if live-call mode, from Gemini native audio),
  leakageCheckStatus: { reviewed: bool, redactions: [...] },
  relayHops: [{ hopUserId, lat, lng, timestamp }] (if mesh kept),
  status: "new" | "acknowledged" | "resolved"
}
```

**Real-time delivery**: the dashboard subscribes to a per-incident channel (websocket/SSE) keyed on `id`, opened the instant the document is created (`callState: "active"`) — every `extractedFieldsLive` update pushes to any subscribed dashboard clients immediately. When `callState` flips to `"ended"` and `consolidatedSummary` is written, that's pushed as the final update, and the dashboard transitions the incident card from "live" styling to a finalized case record.

## 7. 4-week schedule (winning-scope version)

**Week 1 — Foundation**
- Repo scaffolding (mobile + backend + web responder view)
- Deploy skeleton web responder view live on day 1-2 (mandatory deliverable, de-risk early)
- Disguised ordering UI: menu, cart, checkout flow — visual polish matters heavily here since disguise realism is the entire premise
- Backend: endpoint + minimal data model
- **Decide the two open scoping questions in §4 this week**, before Week 2 work depends on the answer

**Week 2 — Core Gen AI mechanism (Tier 1 + start of Tier 2)**
- Gemini Live API integration: persona/system-instruction design
- Structured extraction via function calling
- **Strict build/test rule**: every coded question must state its real meaning in the same breath — write test transcripts and review each one against this rule before building further
- Voice stress/duress detection wired into the same Live API call
- Silent tap-only mode: menu UI with long-press reveal tooltips

**Week 3 — Real-time pipeline + second AI layer + second originality claim (Tier 2 + Tier 4-realtime + Tier 3)**
- **Real-time channel (websocket/SSE) between mobile app and dashboard** — confirm Cloud Run long-lived-connection support first, this gates the live-update demo moment and is worth derisking early, not left to Week 4
- Wire incremental Gemini Live function-calling to push `extractedFieldsLive` updates as they're produced during the call, not batched at the end
- Incident document created + dashboard notified at call START (not call end) — the "responder is already watching" requirement
- Post-extraction leakage-check pass (second Gemini call reviewing extracted report for third-party exposure)
- Universal zero-trace exit gesture
- If SOS path kept: TFLite classifier + Gemma 3 270M alert-gen
- If mesh kept: single-hop relay + Blind Relay encryption/jitter layer
- Android Private Space integration

**Week 4 — Post-call consolidation + completeness + polish (remaining Tier 4 + demo)**
- Post-call consolidation pass: Gemini writes the final coherent incident summary from transcript + all extracted fields + voice-stress trend + leakage-check result, once `callState` flips to `"ended"`
- Responder view: live-updating incident card during an active call, transitioning to consolidated case record at call-end; report list, urgency/voice-stress indicator, severity ordering, hop-trail map if mesh kept
- End-to-end testing of the live-call disguise for convincingness (test with people role-playing an overhearing bystander), AND end-to-end testing that dashboard updates genuinely arrive live during a call, not just after
- Deck + 3-minute demo video — **the real-time live-update moment is likely the strongest single shot in the video**: split-screen the disguised call happening on one device against the dashboard populating live on another, ending with the consolidated case record
- GitHub repo cleanup, deployment hardening

## 8. Honest tradeoff summary (full platform vs. this winning-scope standalone)

| | Full platform | Standalone (winning scope, this doc) |
|---|---|---|
| Build risk | Higher — 2 pillars + 8 features | Still real — this scope adds back Tier 2/3/4 depth specifically because the bare-minimum version was too thin, so it's no longer a small build |
| Demo memorability | Strong if Covert Call leads the pitch | Strongest possible — entire video built around one moment |
| Technical merit depth (40%) | Strong — multiple AI layers across two pillars | Now comparable — Tier 1+2 gives 3-4 distinct AI reasoning steps (conversation, extraction, stress detection, leakage-check), though still within one feature domain rather than two |
| Originality claims | Two: adversarial re-ID loop + shared dual-backbone | Two (restored by this revision): disguised-conversation mechanism + Blind Relay, if mesh is kept — cut to ONE if mesh is dropped, which is a meaningfully weaker position |
| Theme fit ("Sustainability & Social Impact") | Environmental/labor whistleblowing — cleaner, less-replicated fit | Personal-safety/DV-adjacent — closer to Haven's domain, the thing explicitly meant to be avoided; worth addressing directly in the deck rather than ignoring |
| Team effort required | Needs full 2-4 person team across pillars | More concentrated, could suit a smaller effective team, though Tier 2-4 additions mean it's not actually a "smaller build" anymore — it's a narrower one |

**Key implication of this revision**: to genuinely compete for a win standalone, keeping BOTH the SOS/mesh path AND the leakage-check/stress-detection layers is effectively required — the truly minimal version (Tier 1 only) is meaningfully weaker on both technical merit and originality than the full platform. This significantly narrows the actual "less work" advantage standalone was assumed to have.
