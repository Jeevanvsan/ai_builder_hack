# QuickBite — File Structure & 2-Person Collaboration Guide

Companion to `docs/quickbite_plan.md` (what to build) and `docs/backlog.md` (epics/stories/tasks). This doc covers **how** two people build it together: repo layout, ownership split, and the GitHub workflow.

## 1. Repo structure — monorepo

One GitHub repo, satisfying the hackathon's single-public-repo requirement directly. Structure:

```
quickbite/
├── apps/
│   ├── web/                 # QuickBite web app (React, Vite) — Person A owns this
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── disguise/ # home, checkout, silent-tap screens
│   │   │   │   └── call/     # live-call UI (waveform, controls)
│   │   │   └── lib/
│   │   │       └── gemini-live/ # Gemini Live client wrapper
│   │   └── ...
│   │
│   ├── native/               # QuickBite React Native app — Person A owns this, built Week 4
│   │   └── (ports apps/web's mechanism once proven — see plan §5 build order)
│   │
│   └── dashboard/            # Monitoring Dashboard (React, Vite) — Person B owns this
│       ├── src/
│       │   └── pages/
│       │       ├── queue/          # live incident queue
│       │       ├── incident/:id/   # incident detail
│       │       ├── history/        # resolved cases
│       │       └── video/          # stretch: live video page
│       └── ...
│
├── services/
│   └── backend/               # Shared Cloud Run API — SHARED ownership, see §2
│       ├── api/
│       │   ├── incidents/     # create/update incident endpoints
│       │   └── realtime/      # websocket/SSE hub
│       ├── services/
│       │   ├── extraction.ts       # structured extraction from transcript/taps
│       │   ├── stress_detection.ts
│       │   ├── leakage_check.ts
│       │   ├── consolidation.ts
│       │   └── geocoding.ts
│       └── models/
│           └── incident.ts    # shared data model (plan §5b) — the contract between web/native and dashboard
│
├── packages/
│   └── shared-types/          # TypeScript types for the incident data model, shared by web/native/dashboard/backend
│
├── docs/                      # this folder — already exists
│   ├── quickbite_plan.md
│   ├── backlog.md
│   └── collaboration.md
│
├── .github/
│   ├── workflows/             # CI (see §4)
│   └── ISSUE_TEMPLATE/
│
└── README.md                  # mandatory for the hackathon's public-repo deliverable
```

**Why this shape**: `apps/web` and `apps/dashboard` are genuinely separate products (per plan §"Monitoring Dashboard — a separate, dedicated web app") but share one backend and one data contract (`packages/shared-types`, mirroring plan §5b's `incidents` model) — that shared contract is what makes a 2-person split work without constant merge conflicts.

## 2. The 2-person split

Matches the natural epic boundary already in `docs/backlog.md`: **person-facing app** vs. **response-facing dashboard**, both meeting in the middle at the shared data model and real-time channel.

### Person A — "QuickBite" track
Owns: `apps/web`, `apps/native` (later), and the Gemini Live conversation logic.

| Epic (from backlog.md) | Ownership |
|---|---|
| Epic 1 — QuickBite Disguise (all 5 stories) | **A, primary** |
| Epic 2 — Second AI Reasoning Layer (stress detection, leakage check) | **A, primary** — these live conceptually "inside the call," even though leakage-check output is *read* by B's dashboard |
| Epic 6 — Stretch: Mesh Relay | **A** (extends A's silent-tap mode) |
| Epic 7 — Stretch: Back-Camera Video | **A** (native app capture) + **B** (dashboard video page) — genuinely shared, see §3 |

### Person B — "Monitoring Dashboard" track
Owns: `apps/dashboard` and the real-time pipeline's dashboard-facing half.

| Epic (from backlog.md) | Ownership |
|---|---|
| Epic 3 — Real-Time Incident Pipeline (all 4 stories) | **B, primary** — this is the backend/pipeline work that feeds the dashboard, even though some of it (incremental extraction) is triggered by A's Gemini calls |
| Epic 4 — Monitoring Dashboard (all 5 stories) | **B, primary** |
| Epic 7 (dashboard half — Sub-goal A's video player) | **B** |

### Shared / rotating
- `services/backend` — genuinely shared. Recommend: **whoever's story needs a new endpoint writes it**, both review every backend PR (small team, backend is the seam where both tracks meet — a silent contract break here breaks the other person's work invisibly).
- **Epic 5 — Demo & Submission Readiness** — both, explicitly. Don't let one person own the whole submission; the theme-fit answer (plan §10) especially needs both of you to actually agree on it, not just one person deciding.
- `packages/shared-types` — whoever touches the data model first proposes the change via PR, the other reviews before merging (this is the file most likely to cause the other person's build to break if changed carelessly).

## 3. Where the two tracks actually meet (the seams to be careful with)

These are the points where A's and B's work directly depends on each other — coordinate explicitly here, don't assume:

1. **The `incidents` data model** (`packages/shared-types`) — defined once, early (Week 1), changed rarely after. Both agree on the shape from plan §5b before either builds against it.
2. **The real-time channel's message format** — what exactly gets broadcast on each field update (Epic 3.2). A's backend calls emit these; B's dashboard consumes them. Agree on the event shape in Week 1-2, not discovered ad hoc in Week 3.
3. **Incident creation at call-start** (Epic 3.1) — A's app triggers this (the moment a QuickBite session starts), B's dashboard reacts to it. Needs a quick end-to-end test together once both sides exist, not just unit-tested separately.
4. **Epic 7's Sub-goal A** (live video) — the one place both people are building against the *same* new infrastructure (a WebRTC/signaling service) from two different ends (A = sender in the native app, B = viewer in the dashboard). Pick the signaling service together before either starts, since swapping it later means both sides rework.

## 4. GitHub workflow, sized for 2 people / 4 weeks

Keep this lightweight — process overhead is a real cost when there are only two of you and four weeks.

- **Branching**: `main` is always deployable (Cloud Run/Firebase auto-deploys from it, or close to it — see plan's "deploy skeleton live day 1-2" instruction). Each person works on short-lived feature branches, one per user story or a small cluster of related sub-tasks — e.g. `web/live-call-persona`, `dashboard/incident-queue`. Avoid long-lived personal branches; merge often.
- **Commits**: reference the story/task, e.g. `[1.2] wire Gemini Live persona system instructions`. Not mandatory tooling, just a convention so `git log` doubles as a backlog progress trail.
- **Pull requests**: every merge to `main` goes through a PR, even solo work — cheap insurance for a 2-person team, and it's where the *other* person gets visibility into changes touching the shared seams (§3). Self-merge is fine for work fully inside your own track (e.g. A merging a `apps/web` PR); **anything touching `services/backend` or `packages/shared-types` gets the other person's review before merging**, not after.
- **Issues**: mirror `docs/backlog.md`'s epics/stories as GitHub Issues (one issue per user story, sub-tasks as a checklist inside it — GitHub renders `- [ ]` as a checklist automatically) so progress is visible without re-reading the markdown doc. Label by epic (`epic:1-quickbite`, `epic:4-dashboard`, etc.) and by person (`owner:A`, `owner:B`) for a quick filtered view of "what's mine."
- **Project board** (GitHub Projects, built into the repo): one board, columns `Backlog / In Progress / In Review / Done`, cards = the same issues. With only 2 people this can be as simple as a shared glance each morning rather than a heavyweight ceremony.
- **CI** (`.github/workflows/`): minimal — lint + typecheck on PR, and if time allows, a deploy-preview trigger to Cloud Run/Firebase so each PR gets a live preview link before merging (catches "works on my machine" issues early, useful given the real-time channel is the riskiest integration point per §3).

## 5. Daily/weekly sync suggestion (lightweight, not process for its own sake)

- **Daily**: a short async check-in (even just a Slack/Discord message) — what shipped yesterday, what's today, anything blocking on the other person's track.
- **End of each week** (matches the plan's 4-week schedule in §9 of `quickbite_plan.md`): a short sync specifically on the §3 seams — does the data model still match what both sides assume, does the real-time message format need adjusting, is the shared backend drifting from either app's expectations.
- **Week 4 specifically**: per the plan, this is when both tracks converge hardest (dashboard build-out + consolidation + end-to-end testing + demo). Budget more sync time here than earlier weeks, not less.
