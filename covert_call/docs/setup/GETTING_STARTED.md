# Getting Started with QuickBite

## Quick Overview

This is a 4-week hackathon prototype with **separate responsibility areas**:
- **Web App** (`web/`) — Disguised ordering UI + Gemini Live integration (Epics 1, 2, 3)
- **Backend** (`backend/`) — Incident management, real-time streaming, Gemini orchestration (Epics 2, 3)
- **Dashboard** (`dashboard/`) — Monitoring Dashboard, its own separate app for the response team (Epic 4, Person B)
- **Native App** (`native/`) — React Native port (Phase 2, built after web is proven)

## Directory Structure

```
covert_call/
├── web/                    # React (Vite) web app — QuickBite disguise UI (main deliverable)
├── backend/                # FastAPI backend
├── dashboard/              # React (Vite) Monitoring Dashboard — separate app, own deployment
├── native/                 # React Native app (future)
├── docs/                   # Documentation
│   ├── quickbite_plan.md   (← authoritative build reference)
│   ├── backlog.md          (← epics, user stories, sub-tasks)
│   ├── architecture/
│   ├── api/
│   └── setup/              (← you are here)
└── README.md
```

## Development Setup (Per Component)

### Web App Setup
```bash
cd web
npm install
npm run dev
# Runs on http://localhost:5173 (Vite default)
```

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python src/main.py
# Runs on http://localhost:8000
```

### Dashboard Setup
```bash
cd dashboard
npm install
npm run dev
# Runs on http://localhost:5174 (Vite, second port)
```

## Build Reference

**Before starting any component**, read the finalized build plan:
- **`docs/quickbite_plan.md`** — Authoritative scope, features, and tech decisions (supersedes `standalone_covert_call_plan.md`)
- **`docs/backlog.md`** — Epics broken into user stories and sub-tasks

Key sections of `quickbite_plan.md`:
- **§4** — Feature set (core mechanism, second AI layer, real-time response, stretch goals)
- **§5** — Tech stack (web + dashboard + native, Gemini Live, real-time architecture)
- **§5b** — Data model (Firestore schema, including the `response` block for dashboard actions)
- **§9** — 4-week schedule

## Responsibilities (per `docs/backlog.md`)

| Area | Epic | Owner | Tech | Status |
|------|------|-------|------|--------|
| QuickBite disguise UI + Gemini | Epic 1 | ? | React (Vite), Gemini Live | TBD |
| Second AI reasoning layer | Epic 2 | ? | Gemini structured output | TBD |
| Real-time incident pipeline | Epic 3 | ? | FastAPI, Firestore, WebSocket | TBD |
| Monitoring Dashboard | Epic 4 | **Person B** | React (Vite) | In progress |
| Native app port | — | ? | React Native | Phase 2 (after web proven) |

**Note:** Person B owns Epic 4 (Monitoring Dashboard) — its own separate app, own deployment, built for a large-monitor/ops-center display, light-themed. See `docs/backlog.md` Epic 4 for the five user stories (4.1–4.5).

## Environment Setup

Each component has `.env.example` or equivalent. Copy to `.env` and fill in your credentials:
- GCP Project ID
- Gemini API Key
- Firebase config
- Frontend/dashboard URLs

## Real-time Architecture

The system uses **WebSocket + Server-Sent Events** for live updates:
- Backend opens a WebSocket on `/ws/incidents/{id}`
- Both the QuickBite web app (sender side) and the Monitoring Dashboard (receiver side) connect to the same real-time channel
- As Gemini extracts data during the call, updates stream to the dashboard in real time — not batched until the call ends
- Dashboard-side responder actions (acknowledge/in-progress/resolve) also flow back over this channel so every connected dashboard instance sees the same state

See `docs/architecture/` for diagrams.

## Key Features to Build (see `docs/backlog.md` for full breakdown)

### Epic 1 — Core Mechanism 🔴
- [ ] Disguised ordering UI (menu, cart, checkout)
- [ ] Live Gemini conversation with disguised persona
- [ ] Silent tap-only fallback mode
- [ ] Universal zero-trace exit gesture
- [ ] Structured extraction (function calling)

### Epic 2 — Second AI Reasoning Layer 🟡
- [ ] Voice stress/duress detection (Gemini Live native audio)
- [ ] Post-extraction leakage check (third-party exposure)

### Epic 3 — Real-Time Incident Pipeline 🔴
- [ ] Incident created + dashboard notified at call START
- [ ] Live field-by-field streaming during the call
- [ ] Two-stage location flow (rough GPS → confirmed address)
- [ ] Post-call consolidation pass

### Epic 4 — Monitoring Dashboard 🟡 (Person B)
- [ ] 4.1 — Scaffold as its own app, deploy skeleton live day 1-2
- [ ] 4.2 — Multi-case queue view, severity-sorted, big-screen layout
- [ ] 4.3 — Incident detail panel, live-updating → consolidated case record
- [ ] 4.4 — Acknowledge/in-progress/resolve action tracking, synced across viewers
- [ ] 4.5 — Case history view (separate from live queue)

## Testing the Full Flow

Once all components are running:

1. Open QuickBite web app (http://localhost:5173)
2. Trigger a "delivery order" (masked Covert Call)
3. Dashboard (http://localhost:5174) shows a new incident alert instantly
4. Watch incident details populate field-by-field while the call is still active
5. Call ends → consolidated summary replaces the live working state
6. Acknowledge/resolve the incident from the dashboard — confirm the status change is visible to any other open dashboard instance

## Common Commands

```bash
# Install dependencies
npm install          # for web/dashboard
pip install -r requirements.txt  # for backend

# Run dev servers
npm run dev          # Vite (web on 5173, dashboard on 5174)
python src/main.py   # FastAPI (port 8000)

# Type check
npm run type-check   # if TypeScript is used
# Python type checking TBD

# Build for production
npm run build        # Vite production build
# Docker/Cloud Run deployment TBD
```

## Deployment Target

- **Web app + Dashboard**: Cloud Run or Firebase Hosting (two separate deployments/URLs)
- **Backend**: Cloud Run
- **Database**: Firestore
- **Real-time**: WebSocket via Cloud Run long-lived connections

## Team Coordination

- **Sync daily** on:
  - API contract changes (WebSocket message format between backend and dashboard/web)
  - Gemini field extraction structure
  - Location data shape
  - The `response` block schema (acknowledge/resolve state) — shared between backend and dashboard

- **Check `docs/api/`** for endpoint specs (TBD)
- **Check `docs/architecture/`** for system diagrams (TBD)

## References

- [QuickBite build plan (authoritative)](../quickbite_plan.md)
- [Backlog — epics & user stories](../backlog.md)
- [Hackathon rules](https://aibuildercup.com/)
- [Google Cloud documentation](https://cloud.google.com/docs)
- [Gemini API docs](https://ai.google.dev/)

---

**Timeline**: 4 weeks to Oct 18, 2026.
**Current date**: 2026-09-24
**Days left**: 24

Good luck! 🚀
