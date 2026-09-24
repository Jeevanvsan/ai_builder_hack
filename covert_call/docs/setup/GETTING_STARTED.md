# Getting Started with QuickBite

## Quick Overview

This is a 4-week hackathon prototype with **separate responsibility areas**:
- **Web App** (`web/`) — Disguised ordering UI + Gemini Live integration
- **Backend** (`backend/`) — Incident management, real-time streaming, Gemini orchestration
- **Dashboard** (`dashboard/`) — Responder console (managed by Person B)
- **Native App** (`native/`) — React Native port (Phase 2)

## Directory Structure

```
covert_call/
├── web/                    # Next.js web app (main deliverable)
├── backend/                # FastAPI backend
├── dashboard/              # Next.js responder dashboard
├── native/                 # React Native app (future)
├── docs/                   # Documentation
│   ├── standalone_covert_call_plan.md  (← build reference)
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
# Runs on http://localhost:3000
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
# Runs on http://localhost:3001
```

## Build Reference

**Before starting any component**, read the finalized build plan:
- **`docs/standalone_covert_call_plan.md`** — Scope, features, and tech decisions

Key sections:
- **§3** — Feature set (Tier 1–4)
- **§5** — Tech stack (web + native, Gemini Live, real-time architecture)
- **§6** — Data model (Firestore schema)
- **§7** — 4-week schedule

## Responsibilities

| Area | Owner | Tech | Status |
|------|-------|------|--------|
| Web App (disguise UI + Gemini) | ? | Next.js, Gemini Live | TBD |
| Backend (incident mgt, real-time) | ? | FastAPI, Firestore, WebSocket | TBD |
| Dashboard (responder console) | Person B | Next.js | TBD |
| Native app | ? | React Native | Phase 2 |

**Note:** Person B is building the dashboard. Web/backend owners to be assigned.

## Environment Setup

Each component has `.env.example` or equivalent. Copy to `.env` and fill in your credentials:
- GCP Project ID
- Gemini API Key
- Firebase config
- Frontend/dashboard URLs

## Real-time Architecture

The system uses **WebSocket + Server-Sent Events** for live updates:
- Backend opens a WebSocket on `/ws/incidents/{id}`
- Frontend connects and listens for live field updates
- As Gemini extracts data during the call, updates stream to the dashboard in real time

See `docs/architecture/` for diagrams.

## Key Features to Build

### Tier 1 (Core)
- [ ] Live Gemini conversation with disguised persona
- [ ] Silent tap fallback mode
- [ ] Structured extraction (function calling)
- [ ] Zero-trace exit gesture

### Tier 2 (AI Depth)
- [ ] Voice stress detection (Gemini audio)
- [ ] Post-extraction leakage check

### Tier 3 (Originality)
- [ ] Blind Relay (if mesh kept)
- [ ] Private Space integration (Android)

### Tier 4 (Real-time Response)
- [ ] Live dashboard updates during call
- [ ] Two-stage location (GPS + confirmed address)
- [ ] Post-call consolidation
- [ ] Responder view

## Testing the Full Flow

Once all components are running:

1. Open web app (http://localhost:3000)
2. Trigger a "delivery order" (masked Covert Call)
3. Dashboard (http://localhost:3001) shows live updates
4. See incident details populate field-by-field
5. Call ends → consolidated summary replaces live fields

## Common Commands

```bash
# Install dependencies
npm install          # for web/dashboard
pip install -r requirements.txt  # for backend

# Run dev servers
npm run dev          # Next.js (port 3000 or 3001)
python src/main.py   # FastAPI (port 8000)

# Type check
npm run type-check   # Next.js
# Python type checking TBD

# Build for production
npm run build        # Next.js
# Docker/Cloud Run deployment TBD
```

## Deployment Target

- **Web app + Dashboard**: Cloud Run or Firebase Hosting
- **Backend**: Cloud Run
- **Database**: Firestore
- **Real-time**: WebSocket via Cloud Run long-lived connections

## Team Coordination

- **Sync daily** on:
  - API contract changes
  - Real-time message format changes
  - Gemini field extraction structure
  - Location data shape
  
- **Check `docs/api/`** for endpoint specs (TBD)
- **Check `docs/architecture/`** for system diagrams (TBD)

## References

- [Standalone build plan](../standalone_covert_call_plan.md)
- [Hackathon rules](https://aibuildercup.com/)
- [Google Cloud documentation](https://cloud.google.com/docs)
- [Gemini API docs](https://ai.google.dev/)

---

**Timeline**: 4 weeks to Oct 18, 2026.  
**Current date**: 2026-09-24  
**Days left**: 24

Good luck! 🚀
