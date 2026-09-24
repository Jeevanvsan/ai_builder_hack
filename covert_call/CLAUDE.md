# QuickBite (Covert Call) — Folder Context

This folder is the active build workspace for **QuickBite**, the current near-term focus of the AI_Builders_26 hackathon project (see the repo-root `CLAUDE.md` for full project context, hackathon rules, and the eventual-goal full-platform plan).

## The authoritative plan
**Read `docs/quickbite_plan.md` first, before any implementation work.** It supersedes `docs/standalone_covert_call_plan.md` (kept for history only) and consolidates every design correction made during planning into one place: the feature set, tech stack, data model, cost estimate, competitive verification, and 4-week schedule.

**`docs/backlog.md` breaks the plan into Epics → User Stories → Sub-tasks** for actual implementation/tracking work — use this when picking up build tasks rather than re-deriving a task list from the plan prose each time.

**Team is 2 people, using GitHub for version control.** **`docs/collaboration.md`** has the monorepo file structure and the 2-person ownership split: Person A owns QuickBite app (Epics 1, 2, 6, and A's half of 7), Person B owns the Monitoring Dashboard (Epics 3, 4, and B's half of 7), backend/shared-types are jointly reviewed. Read this before scaffolding the repo — it defines the folder layout (`apps/web`, `apps/native`, `apps/dashboard`, `services/backend`, `packages/shared-types`) and the seams where both people's work meets and needs explicit coordination.

**`docs/quickbite_diagrams.html`** — a saved, version-controlled copy of the visual reference (mock UI screens, Monitoring Dashboard mockup, user flow diagram, architecture diagram). Open it directly in a browser (no server needed) to view. Canonical source of truth for the diagrams is the plan/backlog docs — this file is a visual companion, kept in sync manually when the plan changes meaningfully. Live version (may drift ahead of this saved copy): https://claude.ai/artifact/WdmyUMRKkDarV3vV8pAWb2

## What QuickBite is, in one paragraph
A food-delivery-disguised web/mobile app. A person under coercion or observation uses it to covertly summon help. Gemini Live API plays a restaurant-employee persona in a live call, teaching every coded question's real meaning live in the same breath it's asked (zero prior memorization required — this rule has no exceptions). A silent tap-only mode (long-press reveals meaning) covers no-connectivity/no-safe-sound cases. Structured incident data streams to a responder dashboard live, field-by-field, starting the instant the call begins — not batched until it ends.

## The single most important design rule
**Every coded question in the live-call persona must state its real meaning in the same breath it's asked.** No exceptions. This was violated twice in early drafts (a question stated the cover story but not the real meaning) and corrected both times — do not reintroduce this bug when writing persona prompts or example dialogue.

## Critical scope boundary — do not cross
**QuickBite is IDENTIFIED by design, not anonymous.** It is the same threat model as an SOS system: a responder needs to know where/who to send help to. Do NOT add anonymity-protection features (identity scrubbing, adversarial re-identification testing, anonymity-set-size warnings like "k-shield") to QuickBite under any framing — those belong to a separate, deferred concept ("Covert Notice") with the opposite threat model, and applying them here is not just irrelevant but actively contradicts QuickBite's purpose.

## Prototype scope, not production
This is a 4-week hackathon prototype. Do not introduce app-store distribution policy compliance, formal test-suite mandates, legal/liability hardening, or other production-grade concerns unless explicitly asked. "Notification" to a responder means the dashboard's live incident card, not integration with real-world patrol/field units or emergency services.

## Tech stack quick reference
- **Web app** (primary build): Next.js, deployed on Cloud Run/Firebase — satisfies the mandatory deployed-link requirement, fastest to prove the core mechanism, and arguably the most convincing disguise (zero install footprint).
- **Native app** (built after web is proven): React Native, for demo polish and to keep sensor/mesh doors open later.
- **Backend**: Cloud Run (FastAPI or Node), with a real-time channel (websocket/SSE) to the dashboard — required for live field-by-field streaming during an active call.
- **Monitoring Dashboard — its own separate app**, NOT a phone-sized view of QuickBite. Own repo/deploy, built for a large monitor and a **response team** (not one solo viewer): multi-case queue, severity ranking, acknowledge/in-progress/resolve action tracking with shared state across responders. See §5b's `response` data model block in `docs/quickbite_plan.md`. Do not fold this into the QuickBite frontend project or design it phone-first. **Visual theme: LIGHT, not dark** — explicit decision, do not default to a dark control-room aesthetic despite the "ops tool" framing; keep it visually coherent with QuickBite's own light UI. (Verified the diagrams artifact mock already does this correctly — its dashboard content uses theme-aware tokens; only the monitor-bezel chrome and mock video placeholder are intentionally dark, which is fine.)
- **Gen AI**: Gemini Live API (persona conversation + native audio stress detection + incremental function-calling extraction), Gemini structured output (post-call consolidation + leakage-check passes).
- **Location**: device GPS/browser geolocation (instant, not AI) with IP-based fallback for non-phone devices; Google Maps JS + Geocoding APIs for the dashboard.

## Mock-UI bugs already caught — don't reintroduce
1. Screen showing "tap through menu" then a "Call to confirm" button — the two modes (live call / silent tap) are **separate forks from the home screen**, never a sequence where tapping leads into calling.
2. A coded question's real meaning shown only as a caption/annotation below the dialogue, not spoken by the Agent itself — violates the live-teaching rule (§ above). The Agent's actual spoken line must contain the real meaning; any diagram annotation must be explicitly marked as a dev-only note, never implied as part of the call.
3. The Monitoring Dashboard mocked inside a phone frame — it's a wide ops-console for a team, not a phone screen (see above).

## Stretch goal (if time allows, Week 4, only after core is solid)
Image/text attachment on the silent tap-only mode + single-hop Bluetooth mesh relay for zero-connectivity submission. Reuses infrastructure already designed for the deferred full-platform plan — nothing to invent, just import if time allows. Do NOT let this displace core-scope work (live call, real-time dashboard, location flow) or demo/deck prep. Other full-platform pieces (SOS fall/crash detection, Blind Relay, Android Private Space) remain fully deferred and are NOT part of this stretch goal.

**Further stretch goal, mobile app only, back camera only, only if the above is done with time to spare — TWO INDEPENDENT sub-goals, neither gates the other** (user's explicit requirement):
- **Sub-goal A — live video streamed to the Monitoring Dashboard like a video call.** A responder watches continuous real-time video, not text signal. This is a WebRTC-class problem, genuinely new infrastructure (signaling/peer-connection layer, e.g. via a managed service like LiveKit — don't build signaling from scratch in 4 weeks), NOT a reuse of anything already planned. The single biggest addition in the stretch tier — budget real time if attempted, and treat it as the harder of the two sub-goals to actually land.
- **Sub-goal B — Gemini analyzes the same feed into structured signal**, sampled as periodic still frames (Gemini Live's actual mechanism is ~1 frame/sec, tokenized individually — not true continuous video; don't overclaim "live video analysis"). Session cap drops to 2 min with video attached (vs. 15 min audio-only) — needs reconnect handling. Output is structured signal into the incident record, same pattern as every other extraction — never its own "watch video" UI.
- Both ship or don't ship independently of each other — do not treat Sub-goal B as a prerequisite for A, or vice versa.
- **"Silent" precisely means**: no flash, no shutter sound, no visible camera preview to the QuickBite user — all genuinely avoidable. It does NOT mean invisible to the OS: every platform shows some camera-in-use indicator the instant a camera activates, and no app can suppress this (deliberate anti-covert-surveillance security feature) — state this limitation plainly, don't gloss over it.

Full detail, rationale, and the complete 4-week schedule: `docs/quickbite_plan.md`.

## Working conventions
- No native browser dialogs (`window.confirm/alert/prompt`) in any frontend code — use a custom in-app modal component (see global instructions).
