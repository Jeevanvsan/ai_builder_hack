# Prototype Build Plan — AI Builder Cup 2026

Working name: **Sentinel** (placeholder — rename freely)

## 1. Product summary

A dual-channel Gen AI safety platform on one shared AI backbone:

- **Covert Notice** — anonymous incident reporting (environmental/labor violations). Identity never captured, by design.
- **SOS Relay** — emergency detection + mesh relay for accidents/disasters. Participants identified, by design.

Pitch line: *"Reporting is anonymous by design; rescue-relay participation is identified by design — same AI backbone, different threat models."*

## 2. Submission deliverables (mandatory, confirmed from FAQ)

1. Live deployed link (Cloud Run or Firebase)
2. Video demo, under 3 minutes
3. Public GitHub repo
4. Solution deck

Deadline: submission Oct 18, 2026. Team locked Oct 11, 2026.

## 3. Scope split — what's actually deployed live vs. demoed on video

| Component | Platform | Why |
|---|---|---|
| Covert Notice submission — online path | Web (Cloud Run/Firebase) | Public-facing; a plain website is less suspicious than an installed app if someone checks a reporter's phone |
| Covert Notice submission — offline path | React Native app (staged demo) | The original design requires offline submission via mesh (see `docs/initial_plan.txt`) — a browser cannot relay data with no internet, so the offline case genuinely needs the mobile app, riding the same mesh relay infra as SOS |
| Responder Dashboard | Web (Cloud Run/Firebase) | This is the **primary judge-facing deliverable** — must be live and clickable |
| SOS fall/crash sensor detection | React Native app (staged demo) | Needs real accelerometer/gyroscope/barometer — not buildable in a browser in 4 weeks |
| Bluetooth mesh relay | React Native app (staged demo, single hop) | Needs real Bluetooth — browsers can't do reliable device-to-device mesh; shared by both Covert Notice (offline) and SOS |

**Everything judges click into must be the web app.** The phone-sensor and mesh pieces are shown only in the 3-minute video as a staged/controlled demo (explicitly disclosed as staged, same honesty pattern as the rest of the plan). Covert Notice therefore exists in **both** places: web form for reporters with connectivity who want the "just a website" anonymity cover, and the mobile app for offline/mesh submission — both feed the same backend pipeline. This also strengthens the shared-backbone story: the same mesh relay code carries both anonymous Covert Notice payloads and identified SOS location trails.

## 4. Full feature list (finalized)

### Core — Covert Notice
- Multi-modal submission: photo, voice note, or text, via web form
- Gemini vision analyzes photo submissions to infer what's happening
- Anonymization pipeline strips identity signal from text/voice/photo (dialect/idiolect normalization, EXIF stripping, face/plate/tattoo blurring in images, timestamp generalization)
- **Adversarial re-identification agent** — a second Gemini pass tries to re-identify the author/role from the scrubbed report; if it succeeds, the report is sent back for another anonymization pass. Loops until risk score is below threshold.
- **Embedding-based cross-report clustering** (same core technique as Haven's culprit-matching, applied to polluter/violation entities instead of abusers) — reports mentioning the same location/company/individual get linked via vector similarity even when worded very differently.
- **Severity scoring** — each case auto-classified/prioritized so responders see worst cases first (cheap, expected feature for a responder console — gap-closer vs. Haven).
- **Satellite/weather corroboration agent** — asynchronously checks Sentinel-2/Google Earth Engine imagery for the reported location around the reported date; adds supporting evidence to the case file if available. Explicitly NOT a real-time trigger — never gates action (see design rule below).
- **Cryptographic proof-of-existence** — each report gets a hash+timestamp commitment at submission time, so its existence at that time can be proven later without revealing who sent it.

### Core — SOS Relay
- Manual SOS trigger (one tap)
- Automatic on-device fall/crash detection — **corrected architecture** (see §6): a small TFLite time-series classifier (NOT Gemma) analyzes the rolling accelerometer/gyroscope/barometer window, since fall/crash classification is a numeric pattern-recognition task, not a language task, and Gemma is architecturally the wrong tool for it. A check-in countdown runs before escalating, to suppress false positives — **staged drop-test demo, not a clinical accuracy claim**
- Once the TFLite classifier confirms a likely fall and the countdown lapses, **Gemma 3 270M (on-device, via LiteRT-LM)** turns the structured detection event into a short human-readable alert message (e.g. "Possible fall detected at 2:32pm, high-impact deceleration, GPS attached") — this is genuine on-device Gen AI usage, correctly scoped to a task LLMs are actually good at
- Bluetooth mesh hop relay: report hops phone-to-phone until a hop with bandwidth reaches the dashboard; every hop logs its own GPS+timestamp, building a location trail
- Relay participants are identified (opt-in at signup, consent notice: "you may be contacted if near an emergency")

### Shared backbone
- One Gemini triage/clustering layer serving both features: de-identify-and-cluster for Covert Notice, locate-and-prioritize for SOS
- This shared architecture is the core technical-merit story

### Dashboard / responder console (the demo centerpiece)
- **Live re-ID risk dial** — visualizes the anonymization pipeline's risk score dropping in real time as a report is processed
- **Live cluster graph viz** — isolated reports visually snapping together into a linked case as clustering runs
- Case file view per cluster: severity score, satellite corroboration status (if/when available), crypto proof audit trail, relay hop-trail map for SOS cases
- Case list sorted by severity

## 4a. Killer feature — "Covert Call" (disguised conversational SOS)

**The core idea:** a person under direct observation/coercion (abuser in the room, kidnapper nearby) cannot safely use an obvious "report" or "SOS" app. Covert Call disguises the entire interaction as an ordinary food-delivery app — both a fake ordering screen and a live "phone call" with Gemini playing a restaurant employee — while covertly extracting a real structured emergency report underneath. Inspired by the real (if informally-documented) "order a pizza" 911 technique.

**Confirmed via deep research**: no shipped product combines AI-driven, real-time, two-way disguised conversation with structured data extraction. Existing "fake call" apps (bSafe, Circle of 6, UrSafe) are one-way/scripted with no real extraction; existing "disguise mode" DV apps (Aspire News App, StealthGuard) hide a silent reporting form behind camouflage UI but don't simulate a live conversation. This fusion is a genuine, unclaimed gap — see full citations in the research trail for this feature.

**Important safety caveat that shapes the design (from DV-tech-safety org research, e.g. NNEDV/TechSafety.org)**: disguised apps carry real, documented risks — if an abuser ever opens the app once, the disguise is permanently blown with no recovery; users can forget hidden meanings under crisis stress; a prior real disguised app (Aspire News) suffered a data breach exposing victim recordings. **Design must treat this as a carefully-mitigated risk, not a solved problem** — this honesty is itself a credibility point for the deck, not just a caveat to bury.

### Design — how meaning is conveyed (no prior memorization required)

The biggest design flaw to avoid: requiring the person to memorize a hidden code in advance. Under real crisis stress, memorized codes fail. Instead:

- **Live call mode (Gemini Live API, requires connectivity — no offline mode exists for this API)**: Gemini, playing the "restaurant employee" persona, teaches the code AS it asks — e.g. *"Just confirming — if you need extra hot sauce, just say 'yeah, add ketchup' and I'll toss those in!"* sounds like normal delivery chatter to anyone half-listening, but is Gemini explaining, live, what phrase to use if a weapon is present. **This rule has no exceptions — every single coded question Gemini asks during the call must state its real meaning in the same breath, not just the opening question.** E.g. not just *"how many are you feeding tonight?"* (ambiguous on its own) but *"how many are you feeding tonight — just say the real number of people around you right now, I'll get enough garlic bread for everyone"*. The disguise lives in the tone/delivery (sounds like normal restaurant chatter to anyone half-listening), never in requiring the listener to decode anything silently. Gemini adapts follow-up questions based on answers so far (dynamic, not a fixed script) and interprets natural-language answers into structured report fields (people present, urgency, danger indicators, location).
- **Silent tap-only mode (no connectivity, or person can't risk any sound)**: an ordinary-looking food-ordering UI (menu items, quantity selector, search bar, "add to cart"). **Meaning is revealed only on long-press** of any element, showing a brief tooltip styled like a normal app hint (e.g. "🔥 Popular item!") but containing the real instruction (e.g. "Tap this if you are in immediate physical danger right now"). Nothing is visible at a glance — only on deliberate long-press, which is a normal, unsuspicious gesture on real apps. The search bar doubles as free-text input Gemini interprets directly, for maximum flexibility when typing is safer than navigating a fixed menu. (On-screen text tooltip was chosen over a haptic-only reveal for prototype feasibility within the 4-week window — haptic-only is more private but too complex to design/build in time; text tooltip is the accepted tradeoff.)
- **Universal silent exit**: one deliberate, zero-delay, zero-trace gesture (e.g. firm long-press on the app logo) instantly closes the disguise back to a neutral screen, no confirmation dialog, no visible state difference between "report sent" and "backed out" — this asymmetry (an instant, unambiguous exit vs. no unambiguous "start" trigger) is intentional: entering the flow should look like normal app use, but leaving it must never be gated behind anything memorizable.

### Where the real Gen AI is (important — don't oversell the plain UI as AI)

- The tap-based ordering screen's fixed button-to-meaning mapping is plain app logic, NOT Gen AI — be precise about this internally and in the deck.
- **Real Gen AI work**: (1) Gemini Live holding the actual improvised, natural, adaptive disguised conversation in real time — genuine generative dialogue, not scripted; (2) Gemini interpreting free-text/spoken natural-language answers (from either mode) into a structured incident report — this is necessary regardless of mode, since a rigid fixed lookup table breaks the moment real answers don't match expected patterns exactly.

### Technical feasibility notes (from research)

- Gemini Live API: full-duplex WebSocket, sub-second target latency, supports sustained persona/character instructions and async/non-blocking function calling (so structured extraction can run without interrupting conversational flow) — technically realistic for a 4-week build.
- **Hard constraint**: Gemini Live API has no offline mode — this feature only works with connectivity. When offline, falls back to the silent tap-only mode (still functional, lower detail) or the existing mesh-relay Covert Notice/SOS paths.
- Session constraints to plan around: ~10-minute WebSocket connection lifetime, 15-minute audio-only session cap (2 min for audio+video) without using session-resumption tokens — needs explicit reconnect handling for a longer "call."
- Gemini's native audio (not separate STT) means tone/stress/pacing can also feed into urgency scoring directly from the voice itself, reusing the "voice stress detection" capability already planned (§6).

### Feature status

This is a stretch/differentiator feature, not core-path — prioritize after the core Covert Notice + SOS pipeline and dashboard viz are solid (see §7 build schedule). If Week 4 time is tight, the silent tap-only mode alone (no live Gemini call) is a reasonable fallback scope — still genuinely novel per the research, and doesn't depend on live API session management complexity.

### Competitive re-verification (prototype-scope takeaway)

A second, deliberately adversarial search pass confirms this is still unclaimed — closest cousin found ("Guardian AI," a hackathon project) is an overt always-visible monitor, not a disguised persona having a two-way deceptive conversation, so the core mechanism remains a genuine differentiator to lead the pitch with.

**One practical note for the demo build, nothing more**: real AI-911-dispatch companies (Aurelian, Hyper, Carbyne, etc. — building AI on the dispatcher side) have flagged that a naive AI can take a "pizza order" call literally and just process it as a real order, missing the disguise's actual purpose. Worth a quick sanity check while writing the persona's prompt/system instructions and rehearsing the demo script, so it doesn't misfire live in front of judges — not a formal engineering requirement, just good demo prep. (App-store distribution policy considerations are out of scope for a hackathon prototype — not relevant unless this becomes a real shipped product later.)

## 5. Explicit design rules (say these out loud in the deck — they're the differentiators)

- **Identity never captured** (Covert Notice) vs **participants identified by design** (SOS) — same backbone, two threat models, reconciled in one sentence.
- **Satellite corroboration strengthens a case file after the fact; it never delays or gates immediate action.** Action is triggered by the report + cross-report clustering alone. This must be stated explicitly to preempt the "how can you act on this in real time" objection.
- **All sensor/hardware-dependent claims are staged, honestly disclosed demos**, not accuracy claims (fall detection, mesh relay).
- **Competitive honesty slide**: name existing SOS apps (fall/crash detection, duress mode) and Apple/Google's satellite SOS; state clearly that detection/transport are solved problems — the AI triage layer (anonymization, adversarial re-ID, clustering, corroboration) is the unsolved piece neither addresses.

## 5a. Originality check — competitive landscape (confirmed via research)

Individually, several pieces of this system already exist elsewhere and should NOT be pitched as invented here:
- **Anonymous whistleblowing platforms** — mature SaaS category (EthicsPoint/NAVEX, Safecall, WhistleB, and newer entrants like **EQS Integrity Line** which explicitly markets "AI-assisted anonymization and triage"). Corporate-compliance focused, not built for environmental/labor field reporting in low-connectivity regions. Note: "AI-assisted anonymization" alone is no longer a safe originality claim — EQS already uses that phrase commercially. Our differentiator must rest specifically on the adversarial re-identification verification step, not general AI-assisted anonymization.
- **Satellite-based environmental monitoring** — Global Fishing Watch, SkyTruth, Rainforest Connection (RFCx) already do sensor/satellite-first detection well. We are not out-innovating them on remote sensing; we use satellite imagery as an after-the-fact corroboration layer for human testimony, not as a detection system in itself.
- **Mesh-network offline SOS — genuinely crowded, confirmed via a fresh 2026 web search, more so than originally assessed.** Beyond Bridgefy and GoTenna, there is now a dense field of near-identical 2026 hackathon/student projects using the same BLE mesh + Store-Carry-Forward (DTN) approach we planned: SafeHop, MeshAid, MeshRoute, RelayMesh, MeshConnect, ExtremeMesh, meshcomm, mesh-sos-relay — plus **Life Signal**, a shipped app on Google Play doing peer-to-peer distress relay. **This is now the single least defensible originality claim in the plan and should be pitched with explicit humility**, not presented as even a minor innovation.
- **On-device sensor-based crash/fall detection** — Apple Crash Detection, Apple Watch Fall Detection, and Life360 already ship this on their own closed platforms.

**What genuinely appears novel (no existing product found combining these):**
- LLM-based identity-scrubbing anonymization **paired with a second adversarial AI agent** that actively tries to re-identify the sender before a report is accepted as safe — this pattern exists only in academic research (LLM de-anonymization attack papers), not in any deployed whistleblowing product.
- **One shared AI/mesh backbone serving two opposite privacy postures** — anonymous/untraceable reporting and identified/opted-in emergency relay — on the same infrastructure. No evidence found of any existing product spanning both threat models this way; the compliance-SaaS world and the disaster-mesh-app world are built by entirely different, non-overlapping communities.
- The specific **pipeline** linking embedding-based report clustering to asynchronous satellite corroboration in one flow (each half exists separately; the connected pipeline does not).

**Pitch framing (use this, not "we invented X"):** *"Each of these technologies — mesh relay, on-device sensing, LLM anonymization, satellite corroboration — already exists in isolation, built by different companies that don't talk to each other. We're the first to combine them into one dual-purpose AI backbone serving two opposite privacy needs from the same infrastructure."* This is both accurate and a stronger technical-merit argument than false-novelty claims, since it demonstrates market awareness rather than an accidental reinvention.

**Updated caution (post web-search, 2026):** de-emphasize mesh relay specifically when using this framing — it's not just "already exists," it's a crowded field of near-identical concurrent hackathon projects. Lead the pitch with the **adversarial re-identification loop** and the **shared anonymous+identified backbone** as the two load-bearing originality claims; mention mesh relay only as necessary infrastructure, not as a differentiator, even in combination.

## 5b. Feature-by-feature comparison vs. existing platforms (deck-ready table)

| Capability | Existing platforms | What they do | What we do differently |
|---|---|---|---|
| Anonymous incident reporting | EthicsPoint / NAVEX, Safecall, WhistleB, FaceUp, **EQS Integrity Line** (explicitly markets "AI-assisted anonymization and triage"), Whispli | Multi-channel intake (web/phone/app), case routing; some newer platforms (EQS) now advertise AI-assisted anonymization too — this is less of a gap than initially assessed | Still corporate-compliance/HR focused, not built for environmental/labor field reporting in low-connectivity regions with photo/voice evidence; the differentiator must rest on the **adversarial re-identification verification loop** (next row), not on "AI-assisted anonymization" alone, since that phrase is now used commercially |
| Anonymization verification | *(none identified)* | N/A — no product actively tests whether its own anonymization actually worked | **Adversarial re-identification agent**: a second AI tries to unmask the sender before the report is accepted as "safe"; loops until risk score clears threshold. This exists only in academic research papers today, not in any shipped product |
| Environmental violation detection | Global Fishing Watch, SkyTruth, Rainforest Connection (RFCx) | Sensor/satellite/acoustic-first detection systems — they find the event themselves | We don't compete on detection — we use satellite imagery as **after-the-fact corroboration** of a human's testimony, feeding a case file, not as a standalone detection system |
| Case linking across reports | EthicsPoint etc. (manual case management); Haven (embedding-based culprit matching for abuse cases) | Either manual linking, or (Haven) automatic linking of *people* across cases | We apply the same embedding-similarity technique to link *reports about the same location/entity* (factory, site, company), extending Haven's core insight to a new domain |
| Offline/degraded-network emergency relay | Bridgefy, GoTenna, **Life Signal (shipped app)**, and a genuinely crowded field of 2026 hackathon/student projects (SafeHop, MeshAid, MeshRoute, RelayMesh, MeshConnect, ExtremeMesh, meshcomm, mesh-sos-relay) | Phone-to-phone BLE/Wi-Fi Direct mesh with Store-Carry-Forward (DTN) routing for SOS beacons — this is now a **well-populated, near-saturated niche**, not a rare idea; several 2026 projects use the identical technical approach we planned | **Do not lead the pitch with mesh SOS relay itself — it is the least original part of the system.** The mesh layer is table-stakes infrastructure here, not the differentiator; the same mesh transport carrying two different report types (anonymous whistleblowing + identified SOS) into one shared AI triage backbone is still a real distinction, but the mesh technology itself must be pitched humbly |
| On-device crash/fall detection | Apple Crash Detection, Apple Watch Fall Detection, Life360 | Native OS/platform feature, closed ecosystem, escalates only to the phone's own contacts or emergency line | Works on **any Android phone**, not flagship-only; escalation feeds a **custom multi-hop relay + case-clustering system**, not just a single call — a report becomes part of a location trail and a broader triage picture, not an isolated alarm |
| Report existence proof | *(none identified in whistleblowing space)* | Generic notarization/timestamping services exist (OpenTimestamps) but aren't paired with anonymous reporting | Hash+timestamp commitment lets authorities prove a report existed at a given time **without learning who sent it** — addresses a real "was this fabricated after the fact" objection nobody else in this space answers |
| Unified anonymous + identified system | *(none identified)* | Compliance-SaaS vendors and disaster-mesh-app builders are separate, non-overlapping communities — no product spans both | This is the core architectural claim: **one shared AI/mesh backbone serving two opposite privacy postures** — anonymous-by-design reporting and identified-by-design rescue relay |

**How to use this table in the deck**: present it as a "competitive honesty" slide, not a "we're better at everything" slide — for rows where existing platforms clearly do their own thing well (Global Fishing Watch on satellite detection, Apple on crash detection), say so plainly. The credibility comes from being precise about which row is genuinely new (rows 2, 4-partial, 6-partial, 7, 8) versus which rows apply proven technology to a new integrated use case (rows 1, 3, 5, 6-detection-itself).

## 5c. Additional unique features (loophole-driven, confirmed via research)

Found by researching real, documented weaknesses in Android/mesh/anonymous-reporting systems rather than brainstorming generic ideas — each closes a specific, citable gap:

- **k-shield (anonymity-set-size warning)** — before a Covert Notice report is submitted, an AI estimates *"how many people could plausibly know this specific detail?"* against the existing report-clustering index, and warns the reporter if the pool is dangerously small (e.g. "you may be 1 of ~3 people who could know this — consider generalizing or delaying"), with an option to auto-generalize. Solves a real, documented failure mode of anonymous reporting tools: perfect text-scrubbing is meaningless if the *information itself* is rare enough to narrow down to one person. The underlying concept (anonymity sets, k-anonymity) is established privacy theory (OECD.AI, Google Privacy Sandbox) but no anonymous-whistleblowing product surfaces a live, interactive, per-report estimate to the user as a pre-submission decision aid — this is the new part. **Recommended as a headline feature** — cheap (reuses existing clustering infra), demoable in 30 seconds, directly extends already-planned work.
- **Blind Relay (bystander-anonymizing mesh)** — onion-style layered encryption + timing jitter/padding per mesh hop, so a bystander relaying someone else's SOS/report packet cannot be traced, located, or correlated to the relay event by an attacker sniffing mesh traffic. Addresses a real, cited, unsolved problem in mesh network security research (traffic-analysis/correlation attacks) — Apple's Find My network had to specifically engineer around this exact issue. No consumer SOS mesh app (Life Signal, SafeHop, MeshAid, RelayMesh, etc.) documents solving this. Directly strengthens the "identified by design" SOS pillar by making identification *intentional* (the sender chooses to be found) rather than *collateral* (a helping bystander gets exposed as a side effect).
- **Android Private Space integration** — Covert Notice mobile app auto-provisions inside Android's native Private Space (a separate, PIN-gated hidden app environment shipped in stock Android) so it never appears in the normal launcher/app-drawer/install list. Closes a real, documented gap: an installed "report abuse" app is itself evidence if a reporter's phone is searched/seized (well-known risk in journalism/activist OpSec circles), and almost no existing reporting app addresses it. Cheap to build (uses an existing OS primitive, not custom engineering) — must be framed in the deck as legitimate safety use, since Google Play Protect flags stalkerware-pattern self-hiding behavior, so the framing (visible consent, safety-use context) matters.
- **Bellingcat-style "verification ladder" (roadmap-tier, not required for MVP)** — instead of one opaque AI credibility score, expose the corroboration pipeline as a transparent chain of separate, auditable checks (geolocation plausibility, cross-report consistency, satellite match, timeline consistency) modeled on real war-crimes-documentation tradecraft (Bellingcat, Syrian Archive). Genuinely differentiating narratively ("we borrowed investigative-journalism verification tradecraft") but lower priority than k-shield/Blind Relay for the 4-week build — good "what's next" deck material.

## 5d. Advanced Google/Gemini capabilities to showcase (beyond basic text/vision calls)

Researched specifically because Google Cloud staff and industry experts are judging, and 40% of score is technical merit/meaningful Gen AI use — using distinctive platform capabilities (not just chat completions) signals platform fluency:

- **Voice stress/duress detection (Gemini Live API native audio)** — Gemini can reason over raw audio directly (pitch, pace, tone — "Affective Dialog") rather than a separate transcribe-then-analyze pipeline, detecting genuine distress/duress in a voice report and feeding that signal into severity scoring. High priority — cheap to add, directly strengthens existing severity scoring, and also powers the Covert Call feature's urgency detection (§4a).
- **Grounding with Google Maps** — Gemini can cross-reference a claimed incident location against real Google Maps data (250M+ places) in the same API call, checking whether a described facility/business actually exists as claimed — a free, instant plausibility check with no extra infrastructure. High priority: cheap, and distinctly showcases Google-platform fluency to Google Cloud judges specifically.
- **SynthID Detector (content provenance screening)** — screen uploaded evidence photos for AI-generation watermarks to catch likely-fabricated "evidence." Important honesty caveat that must be shown in the UI: a clean result proves the image wasn't made by a *known* Google generator, NOT that the image is authentic — overclaiming this would be a factual misrepresentation. Medium priority; the nuanced, honest framing is itself a credibility point.
- **Gemini 3 structured output + Google Search grounding in one call** — combining structured JSON extraction, search grounding, and function calling in a single API round-trip (rather than separate orchestration steps) simplifies the report-ingestion pipeline (§1 architecture) and is worth using for the core anonymization/extraction flow regardless of the above features.
- **Gemma 4 on-device multimodal (stretch, not core scope)** — newer edge models (E2B/E4B) natively handle image/video/audio on-device via LiteRT-LM, which could let mesh nodes do meaningful anonymization (face-blur, voice redaction) fully offline before anything leaves the device. Interesting roadmap item; likely too ambitious to production-harden alongside everything else in 4 weeks — mention as future work rather than building it.

## 6. Tech stack

- **Frontend**: Next.js (web app — reporting form + dashboard), deployed on **Firebase Hosting** or **Cloud Run**
- **Backend**: FastAPI or Node/Express on **Cloud Run**
- **Gen AI (cloud)**: Gemini (vision analysis, anonymization, adversarial re-ID agent, clustering/embeddings, severity scoring) via Vertex AI or AI Studio
- **Gen AI (on-device)**: **Gemma 3 270M** via **LiteRT-LM** (Google's current recommended Android on-device LLM runtime; pre-converted checkpoint available at `litert-community/gemma-3-270m-it` on Hugging Face) — used ONLY to turn the TFLite classifier's structured fall/crash detection output into a natural-language alert message. Confirmed via research: INT4-quantized footprint is ~125MB, runs on any Android phone from ~2021+ with 2GB+ RAM (no NPU required, no flagship-only restriction), battery impact for occasional event-triggered inference is negligible (<1% for 25 uses in Google's own benchmark). Needs a tightly constrained prompt template + output validation fallback (not free-form generation) since this is a safety-critical message — a malformed/hallucinated alert is unacceptable.
- **On-device sensor classifier (SOS fall/crash detection)**: a small **TFLite** (LiteRT) time-series model, NOT Gemma/an LLM — fall/crash detection from accelerometer/gyroscope/barometer is a numeric pattern-classification task that a purpose-built tiny CNN model solves better and lighter (tens of KB, sub-millisecond inference) than forcing a language model to do it. This correction was made after confirming Gemma is architecturally mismatched for raw sensor time-series classification.
- **Satellite data**: Sentinel Hub / Copernicus Data Space Ecosystem REST API (free tier), or Google Earth Engine if time allows (native GCP integration bonus point)
- **Storage**: Firestore or Cloud SQL for case data; Cloud Storage for photo/voice uploads
- **Crypto proof layer**: lightweight hash+timestamp commitment (e.g. OpenTimestamps-style or a simple signed append-only log) — off-the-shelf library, not built from scratch
- **Mobile app (SOS + mesh)**: **React Native**, not plain web React — needs real native sensor access (`react-native-sensors`) and real Bluetooth (`react-native-ble-plx` or similar), neither of which a browser can do reliably (Web Bluetooth is too limited: no background operation, no true peer-to-peer mesh, poor iOS support). Same React/JSX skill set as the Next.js web app, different runtime/target — efficient for a small team to maintain both.
- **Mesh relay scope**: true multi-hop relay (A→B→C→dashboard) needs custom native module work and is optimistic for 4 weeks. Realistic scope: build and demo a convincing **single hop** (phone A relays to phone B which has connectivity), describe multi-hop as architecture/roadmap rather than a fully working live N-hop mesh.

## 7. 4-week build priority (against Oct 18 deadline)

**Week 1**
- Web app skeleton (reporting form + dashboard shell) deployed to Cloud Run/Firebase from day 1 (deploy early, iterate on a live URL throughout — de-risks the mandatory live-link requirement)
- Gemini anonymization + vision pipeline for Covert Notice
- Basic case data model (Firestore/Cloud SQL)

**Week 2**
- Adversarial re-identification agent loop
- Embedding-based clustering + severity scoring
- Dashboard: case list, case file view

**Week 3**
- Live re-ID risk dial + cluster graph viz (the demo centerpiece)
- Satellite corroboration agent (Sentinel Hub integration, async job)
- Crypto proof-of-existence layer

**Week 4**
- TFLite fall/crash classifier + check-in countdown (staged demo)
- Gemma 3 270M (LiteRT-LM) alert-message generation from confirmed detections
- Bluetooth mesh relay + hop logging, shared by SOS and offline Covert Notice submission (staged demo, single hop)
- Hop-trail map view in dashboard
- Deck + 3-minute demo script built around the triage layer and the live dashboard viz, not the sensor trigger
- Buffer for bug fixes, deployment hardening, GitHub repo cleanup

## 8. Known limitations to disclose honestly in the deck

- Satellite imagery: 10m resolution (Sentinel-2), 3-5 day revisit, often 1-2+ weeks for a cloud-free image — framed as case-file corroboration, not real-time proof
- Fall/crash detection: staged drop-test demo, not clinically validated
- Coverage for mesh relay = app users only; density scales with adoption (roadmap: low-cost LoRa gateway nodes, long-term Find My Device network registration — explicitly framed as future work, not built)
