# AI Builder Cup 2026 — Project Context

## What this project is
Submission for **AI Builder Cup 2026 | Google Cloud JAPAC Hackathon**, theme "Sustainability & Social Impact." Solo/small-team hackathon repo — currently just planning docs in `docs/`, no code yet.

**Standing scope reminder: this is a 4-week hackathon prototype, not an enterprise/production product.** Size all recommendations accordingly — a convincing live demo + 3-minute video is the bar, not production hardening. Do NOT bring in app-store distribution policy compliance, formal test-suite mandates, legal/liability hardening, or similar production-grade concerns unless the user asks. If a real-world risk is worth a one-line mention for demo reliability (e.g. "sanity-check this while rehearsing"), keep it that light — don't escalate it into a formal requirement.

## Hard constraints (from the hackathon rules)
- Submission deadline: **Oct 18, 2026**. Team must be locked by **Oct 11, 2026**.
- Team: 2–4 members, 21+, working professionals only (students disqualified even after shortlisting).
- **Mandatory tech**: must use Gemini or Gemma (or Agent Platform / Antigravity / AI Studio), deployed on **Cloud Run or Firebase**. Render/Vercel do not qualify.
- **Scoring (CORRECTED — re-verified directly against https://aibuildercup.com/themes.html, previous "40/25/rest" note in this file was imprecise, do not use it):**
  - **Technical Merit & Gen AI Implementation — 40%**
  - **Problem Alignment & Impact — 25%** (a distinct, separate criterion — theme fit is scored on its own, not folded into originality)
  - **Innovation & Creativity — 25%** (this is the actual "originality" criterion)
  - **User Experience & Solution Design — 10%** (previously untracked in this project's planning — disguise realism and dashboard usability are a real scored line item, not just polish)
- A chatbot wrapper loses on technical merit even with a good cause.
- **Verbatim theme description** (Sustainability & Social Impact): "Build an AI-powered solution that addresses a meaningful environmental or societal challenge." Approaches named: resource efficiency, accessibility, **resilience strengthening**, **community support**, informed decision-making. QuickBite's fit rests on "resilience strengthening" and "community support," not the environmental angle — already the working theory in this project's planning, now confirmed against the live page's exact wording.
- **Other five themes exist** (BFSI, Retail & Commerce, Manufacturing, Media/Content, Future of Work) — irrelevant to this project's chosen theme, noted here only so a future session doesn't need to re-fetch the page to confirm Sustainability & Social Impact is one of six, not the only option.
- **Submission deliverables (confirmed from FAQ page)**: (1) a working **deployed link** of the prototype (live, clickable — must actually run on Cloud Run/Firebase), (2) a **video demo** under 3 minutes, (3) a **public GitHub repository**, (4) a **solution deck**. The live deployed link is mandatory, not optional — judges click into a real running app, not just watch the video.

## Inspiration source (do not replicate)
Inspired by prior hackathon winner "Haven" ([Devpost](https://devpost.com/software/haven-w7mj9g), [GitHub](https://github.com/annu12340/Haven/tree/aws_bedrock)) — steganographic SOS + anonymization + culprit-matching for domestic violence reporting. We reuse its structural DNA (constrained population + covert channel + responder console + cross-case intelligence) but apply it to environmental/labor whistleblowing + accident SOS instead, per explicit instruction not to replicate Haven's domain.

## Current chosen direction
Dual-channel Gen AI safety platform, reframed from the Haven (Devpost) project's DNA but in the environmental-whistleblower domain instead of domestic violence, to avoid replication:

1. **Covert Notice** — anonymous incident reporting (photo/voice/text). Web form for reporters with connectivity; React Native app for offline submission via mesh (a browser can't work with no internet). Gemini vision infers what's happening from photos; an anonymization pipeline strips identity signal from text/voice/photo; an adversarial re-identification agent verifies the report can't be traced back before it goes out. Design rule: **identity never captured**.
2. **SOS** — emergency relay. Manual trigger + automatic on-device fall/crash detection: a small **TFLite** classifier (not Gemma — sensor time-series classification is a numeric task, architecturally the wrong fit for an LLM) analyzes accelerometer/gyroscope/barometer data, with a check-in countdown to avoid false positives; once confirmed, **Gemma 3 270M** (on-device via LiteRT-LM) turns the detection into a natural-language alert message. Relays hop-to-hop through nearby app users until a hop with bandwidth reaches the dashboard; every hop logs its own GPS+timestamp (better location trail than a single last-fix). Relay participants ARE identified (opt-in) so authorities can contact them. Design rule: **participants identified by design** — deliberately a different threat model from Covert Notice.

Both features feed one shared Gemini triage/clustering layer (de-identify-and-cluster for reports, locate-and-prioritize for rescue) — this shared backbone is the core technical-merit story, not either feature alone.

One-line pitch: *"Reporting is anonymous by design; rescue-relay participation is identified by design — same AI backbone, different threat models."*

See `docs/initial_plan.txt` and `docs/brainstorming_discussion.txt` for full reasoning and competitive analysis (vs. Apple/Google built-in SOS, vs. Haven).

**See `docs/prototype_build_plan.md` for the finalized, full build plan**: complete feature list (including the live re-ID risk dial, cluster graph viz, satellite/weather corroboration agent, crypto proof-of-existence layer, severity scoring), web-vs-mobile scope split, tech stack, and 4-week schedule.

**See `docs/implementation_plan.md` for the detailed engineering implementation plan**: system architecture diagram, Firestore data model, repo structure, per-week task checklist, and risk register with mitigations (including scope-cutting priority order if time runs short).

## CURRENT NEAR-TERM FOCUS (as of this decision, supersedes the "full platform" default below for active build work)
**App name: "QuickBite"** — the disguised food-delivery app that IS the Covert Call mechanism. Deliberately generic/realistic name (not a "clever" name with a hidden safety meaning) chosen specifically to maximize disguise credibility, since the whole feature depends on it looking like an ordinary delivery app. Use "QuickBite" consistently in the deck, GitHub repo, demo video, and UI. "Covert Call" remains the internal/planning-doc term for the underlying mechanism.

**User has decided: build QuickBite (Covert Call) ONLY for now.** Not the full platform, not even the Covert Call + adversarial-re-ID + k-shield + shared-backbone bundle that was recommended — literally just this one mechanism (the disguised-order → covert SOS flow, see §4a of `docs/prototype_build_plan.md`), validated end-to-end, before committing to anything that surrounds it.

**Important category correction, caught by the user directly — do not reintroduce**: k-shield (anonymity-set-size warning) and the adversarial re-identification loop are NOT deferred additions for Covert Call, they are simply inapplicable to it, permanently, under any framing. Both protect an ANONYMOUS/untraceable reporter (Covert Notice's threat model: "identity never captured"). Covert Call is IDENTIFIED by design, same threat model as SOS Relay — a responder needs to know where/who to send help to. Warning a Covert Call user "you might be identifiable," or verifying their report "can't be traced back," directly contradicts the feature's purpose. These two features only become relevant again if/when the separate Covert Notice anonymous pillar is built. Currently, standalone, Covert Call has only ONE genuine novelty claim (itself) — the shared-backbone claim is conditional on Covert Notice existing too, and is not currently available as a claim on its own.

**Reasoning behind this (don't re-litigate without new information)**: user correctly challenged that most of the platform's other features are honestly commodity/already-existing (mesh relay is a crowded field, satellite corroboration is out-innovated by Global Fishing Watch etc., basic anonymization is now marketed by EQS, fall detection is shipped by Apple/Life360) — Covert Call is the one piece confirmed genuinely unclaimed. Rather than build scaffolding around an unproven core mechanism, the decision is to prove Covert Call itself works first (Gemini Live persona conversation, live-taught coded questions, structured extraction, real-time dashboard streaming) and decide what surrounds it — full platform vs. a leaner bundle vs. something else — AFTER it's validated, not before.

**The full dual-pillar platform (Covert Notice whistleblowing + SOS Relay) remains the longer-term/eventual goal, per the user's own words ("primary focus now, full platform stays the eventual goal")** — this is a sequencing decision, not a scope cut. Do not assume the platform has been abandoned; do not assume it's been committed to either. Build plan for the current focus: **`covert_call/docs/standalone_covert_call_plan.md`** (moved here from `docs/` into its own project folder — originally written as a standalone-scope comparison doc, now doubles as the actual near-term build reference for the Covert Call mechanism itself — Tier 1 and Tier 2 of that doc, real-time streaming + post-call consolidation from §Tier 4, are the relevant sections; Tier 3's Blind Relay/Private Space and the SOS/mesh questions in §4 are NOT yet decided and lower priority until Covert Call itself is proven).

## Covert Call project folder
Active near-term build work for Covert Call lives under **`covert_call/`** (separate from the root `docs/` folder, which holds the full-platform planning docs). `covert_call/docs/standalone_covert_call_plan.md` is the current build reference. Future Covert Call code/assets should also go under `covert_call/`, keeping it self-contained and separable from the full-platform work if/when that resumes.

**QuickBite platform decision (differs from the full platform's tech stack below): build BOTH a web app AND a native app.** Unlike the full platform's SOS/mesh pieces, QuickBite's core mechanism (disguised ordering UI, Gemini Live conversation, structured extraction) needs no native sensors or Bluetooth — Gemini Live runs over a standard WebSocket, which works fine from a browser. Build the **web app first** (Next.js, Cloud Run/Firebase — satisfies the mandatory deployed-link requirement directly, fastest to prove the core mechanism, and arguably a MORE convincing disguise than a native app since there's zero install footprint). Then port to **React Native** once proven, for a more convincing "real app" demo feel and to keep the door open for SOS/mesh features later. Full detail in `covert_call/docs/standalone_covert_call_plan.md` §5.

## Tech stack summary
- **Web app** (Covert Notice online reporting form + Responder Dashboard): React (Next.js), deployed on Cloud Run or Firebase — this is the mandatory live-clickable submission deliverable.
- **Mobile app** (Covert Notice offline/mesh path, SOS sensor detection, Bluetooth mesh relay): **React Native**, not plain web React — browsers can't do reliable native sensor streaming or peer-to-peer Bluetooth mesh. Shown as a staged demo in the video, not deployed live. Mesh relay scoped to a convincing single hop; multi-hop is roadmap only. Same mesh relay code carries both Covert Notice offline reports and SOS location trails.
- **On-device AI split**: TFLite (LiteRT) small CNN for fall/crash sensor classification (numeric task — Gemma is the wrong tool for this); Gemma 3 270M via LiteRT-LM only for turning a confirmed detection into a natural-language alert message (genuine, correctly-scoped on-device Gen AI usage).

## Originality / competitive honesty (see `docs/prototype_build_plan.md` §5a for full detail)
Most individual pieces of this system already exist elsewhere (anonymous whistleblowing SaaS, satellite environmental monitoring like Global Fishing Watch, mesh SOS apps like Bridgefy/GoTenna, on-device crash detection like Apple/Life360) — do NOT pitch any single piece as invented. The genuinely novel claim is the **combination**: adversarial re-identification testing of anonymization (research-stage elsewhere, not shipped), and one shared AI/mesh backbone serving both an anonymous-untraceable channel and an identified-relay channel (no existing product spans both threat models this way).

## Reference links
See `docs/hackathone_ref_urls.md` for the official hackathon site (rules/themes/FAQs).

## Working conventions
- No native browser dialogs (`window.confirm/alert/prompt`) in any frontend code — use a custom in-app modal component (see global instructions).
