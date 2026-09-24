# Full Implementation Plan — AI Builder Cup 2026

Companion to `docs/prototype_build_plan.md` (product/feature scope) — this doc covers system architecture, data model, repo structure, and detailed engineering tasks.

## 1. System architecture

```
                         ┌─────────────────────────┐
                         │      Web App (Next.js)   │
                         │  Cloud Run / Firebase     │
                         │                           │
                         │  - Covert Notice form     │
                         │  - Responder Dashboard    │
                         └────────────┬──────────────┘
                                      │ REST/HTTPS
                                      ▼
                         ┌─────────────────────────┐
                         │   Backend API (Cloud Run) │
                         │   FastAPI (Python)        │
                         └────────────┬──────────────┘
                                      │
        ┌─────────────────┬──────────┼──────────┬─────────────────┐
        ▼                 ▼          ▼          ▼                 ▼
  ┌───────────┐    ┌────────────┐ ┌────────┐ ┌──────────┐  ┌─────────────┐
  │ Gemini API │    │ Firestore  │ │ Cloud  │ │ Sentinel  │  │ Crypto proof │
  │ (Vertex AI)│    │ (case data)│ │Storage │ │ Hub API   │  │ (timestamp)  │
  │            │    │            │ │(media) │ │(satellite)│  │              │
  └───────────┘    └────────────┘ └────────┘ └──────────┘  └─────────────┘

                         ┌─────────────────────────┐
                         │  Mobile App (React Native)│
                         │                           │
                         │  - Covert Notice (offline)│
                         │  - SOS trigger            │
                         │  - TFLite fall classifier  │
                         │  - Gemma 3 270M (LiteRT-LM)│
                         │  - Bluetooth mesh relay    │
                         └────────────┬──────────────┘
                                      │ syncs when connectivity found
                                      │ (direct HTTPS, or via relay hop)
                                      ▼
                              Backend API (same as above)
```

**Data flow — Covert Notice (online):**
1. Reporter submits photo/voice/text via web form → Backend API.
2. Backend calls Gemini vision (photo) → structured incident description.
3. Backend runs anonymization pass (Gemini) → scrubbed report.
4. Backend runs adversarial re-identification agent (Gemini) against scrubbed report → risk score. If above threshold, loop back to anonymization (max N retries, then flag for manual review).
5. Report embedded (Gemini embeddings) → compared against existing case clusters (vector similarity in Firestore or a vector index) → joined to existing cluster or starts a new one.
6. Severity scoring (Gemini) run per report and rolled up per cluster.
7. Crypto proof-of-existence hash+timestamp generated and stored with the report.
8. Async job: satellite corroboration check queued (does not block steps 1-7).
9. Dashboard reflects the new/updated case in near-real-time (poll or websocket).

**Data flow — Covert Notice (offline/mesh):**
1. Reporter submits via mobile app with no connectivity → payload queued locally, hashed+timestamped on-device (crypto proof survives the offline gap).
2. Payload relays via Bluetooth mesh hop(s) until a hop with connectivity syncs it to Backend API.
3. From step 2 of the online flow onward, identical pipeline.

**Data flow — SOS:**
1. TFLite classifier continuously scores rolling sensor window on-device.
2. On threshold crossing → check-in countdown UI (local only, no network needed).
3. If not cancelled → Gemma 3 270M generates alert message from structured event (on-device).
4. SOS payload (alert message + GPS + timestamp + battery) relays via Bluetooth mesh (or direct if connectivity exists) → Backend API.
5. Each hop appends its own GPS+timestamp before forwarding → Backend reconstructs hop-trail.
6. Backend runs same Gemini triage layer (severity, and clustering against other SOS/location reports) → dashboard hop-trail map view.

## 2. Data model (Firestore collections — adjust if using Cloud SQL instead)

**`reports`** (individual Covert Notice submissions)
```
{
  id, submittedAt, channel: "web" | "mobile-offline",
  rawMediaRefs: [CloudStorage paths] (deleted after processing, or retained encrypted),
  scrubbedText, photoAnalysis: {...Gemini vision output},
  anonymizationRiskScore, anonymizationPasses: n,
  embeddingVector,
  severityScore,
  clusterId (FK -> clusters),
  cryptoProof: { hash, timestamp, commitmentRef },
  satelliteCorroboration: { status: "pending"|"checked", imageDate, matchConfidence, imageRef } | null
}
```

**`clusters`** (linked cases)
```
{
  id, createdAt, updatedAt,
  reportIds: [...],
  locationEstimate: { lat, lng, confidence },
  aggregateSeverity,
  entityMentions: [{ name/company, confidence }],  // from clustering
  status: "open" | "escalated" | "closed"
}
```

**`sos_events`**
```
{
  id, triggeredAt, triggerType: "manual" | "auto-sensor",
  senderId (opt-in identified),
  detectionConfidence (from TFLite classifier, if auto),
  alertMessage (Gemma-generated),
  hops: [{ hopUserId, lat, lng, timestamp }],
  status: "relaying" | "delivered" | "resolved"
}
```

**`users`** (mobile app, SOS relay participants only — Covert Notice reporters are NOT in this table by design)
```
{
  id, phone/email, consentGiven: bool, consentTimestamp,
  relayParticipationOptIn: bool
}
```

## 3. Repo structure

```
/web                  # Next.js app (reporting form + dashboard)
  /app
    /report            # Covert Notice web form
    /dashboard          # Responder console
      /cases
      /cases/[id]       # Case file view (risk dial, cluster graph, hop map)
  /components
  /lib                  # API client, shared types

/backend               # FastAPI service, deployed to Cloud Run
  /api
    /reports
    /clusters
    /sos
  /services
    anonymization.py
    reidentification_agent.py
    clustering.py
    severity.py
    satellite_corroboration.py
    crypto_proof.py
  /models               # Pydantic schemas matching Firestore data model

/mobile                # React Native app
  /src
    /screens
      CovertNoticeScreen.tsx
      SOSScreen.tsx
    /sensors
      fallClassifier.ts     # TFLite inference wrapper
    /ai
      alertGenerator.ts     # Gemma 3 270M via LiteRT-LM
    /mesh
      bluetoothRelay.ts

/ml
  /fall_classifier        # TFLite model training/export (or a pre-trained model + fine-tune notes)
    train.py
    export_tflite.py
    model.tflite

/docs                   # planning docs (existing)
```

## 4. Detailed 4-week engineering plan

Priority tiers referenced below (see §5 risk register for the full cutting logic):
- **P0 (non-negotiable)** — the mandatory live web deployment + core Covert Notice pipeline + dashboard viz. This alone must be solid; it's the primary judge-facing deliverable.
- **P1 (strong differentiators, build if P0 is on track)** — k-shield, satellite corroboration, crypto proof, severity scoring, voice stress detection, Maps grounding.
- **P2 (stretch, cut first if time runs short)** — SOS mobile app (TFLite classifier, Gemma alert generation, mesh relay), Covert Call, Blind Relay, Private Space integration, SynthID screening.

### Week 1 — Foundation + Covert Notice core pipeline (P0)
- [ ] Repo scaffolding (web, backend, mobile skeletons)
- [ ] Deploy skeleton web app to Cloud Run/Firebase on day 1-2 (de-risk the mandatory live-link requirement early)
- [ ] Backend: `/reports` endpoint, Firestore schema, Cloud Storage upload flow
- [ ] Gemini integration: photo vision analysis + text/voice anonymization pass (media anonymization: EXIF/metadata strip, face/plate blur via Gemini vision detection, re-encode to disrupt sensor fingerprinting, voice handling for video audio)
- [ ] Web: Covert Notice submission form (photo/voice/text upload)
- [ ] Basic case list view (no viz yet, just a table)

### Week 2 — Intelligence layer (P0 core + P1 additions)
- [ ] Adversarial re-identification agent (second Gemini call + retry loop) — **P0**
- [ ] Embedding generation + cosine-similarity clustering logic — **P0**
- [ ] Severity scoring (Gemini prompt + structured output) — **P1**
- [ ] Dashboard: case file detail view (static, no live animation yet) — **P0**
- [ ] Crypto proof-of-existence: hash+timestamp on submission — **P1**
- [ ] k-shield: anonymity-set-size estimator shown pre-submission, reusing the clustering index — **P1, recommended headline feature, cheap given clustering already exists**
- [ ] Voice stress/duress detection via Gemini Live API native audio, feeding severity scoring — **P1**
- [ ] Grounding with Google Maps: plausibility-check claimed incident locations against real Maps data — **P1, cheap, showcases Google-platform fluency**

### Week 3 — Demo centerpiece + corroboration (P0 viz + P1 corroboration)
- [ ] Live re-ID risk dial (frontend animation wired to backend risk-score events, via polling or SSE/websocket) — **P0**
- [ ] Live cluster graph viz (force-directed layout of report nodes snapping into cluster groups) — **P0**
- [ ] Satellite corroboration: Sentinel Hub API integration, async worker, case-file display of corroboration status — **P1**
- [ ] Seed demo data: pre-select 1-2 known-good satellite dates/locations for the live demo (disclosed as staged in the deck)
- [ ] SynthID Detector screening for uploaded evidence photos, with the "not proof of authenticity" caveat shown in UI — **P2, if time allows**

### Week 4 — Mobile + SOS + killer features + polish (P2, cut first if behind)
- [ ] TFLite fall/crash classifier: use a pretrained/open-source model, do NOT train from scratch (time risk)
- [ ] Gemma 3 270M integration via LiteRT-LM, prompt template + output validation fallback
- [ ] Bluetooth mesh: single-hop relay (phone A → phone B → backend), shared code path for SOS and offline Covert Notice
- [ ] Blind Relay: onion-style hop encryption + timing jitter on the mesh relay, if mesh relay itself is on track — **P2, stretch on top of a stretch**
- [ ] Android Private Space integration for the Covert Notice mobile app — **P2**
- [ ] Covert Call: silent tap-only mode first (button UI + long-press reveal, no live Gemini call) — **P2, reduced-scope fallback if time is tight**
- [ ] Covert Call: live Gemini call mode (Gemini Live API persona + structured extraction) — **P2, full scope, only if silent mode lands early**
- [ ] Hop-trail map view in dashboard
- [ ] Staged drop-test demo recording for the video
- [ ] Deck assembly (see `docs/prototype_build_plan.md` §5/§5a/§5b for framing, §5c/§5d for killer-feature and Google-AI talking points)
- [ ] 3-minute demo video script + recording
- [ ] Final deployment hardening, GitHub repo cleanup (README, LICENSE, clear setup instructions — judges will look at the public repo)
- [ ] Buffer / bug fixes

## 5. Risk register (biggest things that can go wrong, and the mitigation already chosen)

| Risk | Mitigation |
|---|---|
| Live deployed link breaks near deadline | Deploy from Week 1 day 1, keep it live continuously, not a last-minute deploy |
| Satellite demo has no clear image for the chosen location/date | Pre-select and verify a known-good example early (Week 3), don't rely on live lookup for the actual demo |
| Multi-hop mesh relay doesn't work reliably | Scope to single-hop only; describe multi-hop as roadmap, not a live claim |
| Gemma alert message hallucinates/malforms during demo | Constrained prompt template + validation fallback to a deterministic templated sentence |
| Fall classifier has no real training data | Use a pretrained/open-source TFLite fall-detection model or synthetic/staged drop-test data; do not claim clinical accuracy |
| Covert Call's live Gemini call mode misses a coded question's live-stated meaning | Strict rule, no exceptions: every coded question must state its real meaning in the same breath it's asked (see `docs/prototype_build_plan.md` §4a) — review all example/prompt copy against this before demo |
| Covert Call disguise risk (per DV-safety-org research) | Universal instant zero-trace exit gesture; no visible state difference between "report sent" and "backed out"; disclose the risk honestly in the deck rather than claiming the disguise is foolproof |
| Team runs out of time for all features | **Priority order if cutting scope (P0 → P1 → P2, see §4 tiers)**: (1) Covert Notice web pipeline + dashboard viz are non-negotiable — this is the core technical-merit story and the mandatory deployed deliverable, (2) k-shield, satellite corroboration, crypto proof, severity scoring, voice stress, Maps grounding are strong differentiators but droppable to "built but not demoed live" if needed, (3) the entire SOS mobile app + Covert Call + Blind Relay + Private Space are the most droppable tier — reduce to a video mockup/staged demo before cutting anything in tier 1 or 2 |

## 6. Master execution checklist (cross-reference, single source of truth for "what's decided")

This implementation plan and `docs/prototype_build_plan.md` together represent the finalized plan. Before writing any code, confirm:
- [ ] Team is locked (2-4 members, 21+, working professionals) — **deadline Oct 11, 2026**
- [ ] Google Cloud project set up (Vertex AI / AI Studio access, Cloud Run, Firebase)
- [ ] Repo created (public, for the mandatory GitHub deliverable) with the structure in §3
- [ ] Working name/branding decided (currently placeholder "Sentinel")
- [ ] Read `docs/prototype_build_plan.md` in full (product scope, feature list, originality framing, comparison table) before starting Week 1 — the "why" behind each feature lives there, not here
