# QuickBite Project Structure — Complete Map

## Overview

All folders are created and ready. No code implementation yet — structure-only, with `.gitkeep` files to preserve empty directories.

## Full Directory Tree

```
covert_call/
├── web/                          # Next.js web app (main user-facing deliverable)
│   ├── src/
│   │   ├── app/                 # Next.js pages & routes
│   │   │   └── (incident)/      # Dynamic incident routes
│   │   ├── components/          # React components
│   │   │   ├── disguise/        # Food-delivery UI (the cover story)
│   │   │   ├── gemini/          # Gemini Live integration components
│   │   │   └── responder/       # Responder-side components (if embedded)
│   │   ├── lib/                 # Utilities & services
│   │   │   ├── gemini/          # Gemini API helpers
│   │   │   ├── realtime/        # WebSocket/SSE client logic
│   │   │   └── location/        # GPS, Google Maps integration
│   │   └── public/              # Static assets
│   ├── package.json             # (to be created)
│   ├── next.config.js           # (to be created)
│   └── tsconfig.json            # (to be created)
│
├── native/                       # React Native app (Phase 2, demo purposes)
│   ├── src/
│   │   ├── screens/             # Native screens (parallel to web pages)
│   │   ├── components/          # Shared components
│   │   └── lib/                 # Native utilities
│   └── package.json             # (to be created)
│
├── backend/                      # FastAPI backend (incident management + Gemini orchestration)
│   ├── src/
│   │   ├── main.py              # (to be created) FastAPI app entry point
│   │   ├── routes/              # API endpoints
│   │   │   ├── incidents.py     # (to be created) POST start, GET list, PATCH updates
│   │   │   ├── reports.py       # (to be created) Consolidation & leakage-check routes
│   │   │   └── realtime.py      # (to be created) WebSocket /ws/incidents/{id}
│   │   ├── services/            # Business logic
│   │   │   ├── gemini_service.py # (to be created) Gemini API calls
│   │   │   └── firestore_service.py # (to be created) Database operations
│   │   ├── models/              # Pydantic/data models
│   │   ├── middleware/          # Request logging, CORS, auth
│   │   └── realtime/            # WebSocket connection manager
│   ├── requirements.txt         # (to be created) Python dependencies
│   ├── .env.example             # (to be created) Configuration template
│   └── Dockerfile               # (to be created for Cloud Run deployment)
│
├── dashboard/                    # Next.js responder dashboard (Person B's work)
│   ├── src/
│   │   ├── app/                 # Pages (incidents list, incident detail view)
│   │   ├── components/          # Dashboard UI
│   │   └── lib/                 # Dashboard utilities (WebSocket client, state mgmt)
│   ├── public/                  # Static assets
│   ├── package.json             # (to be created)
│   ├── next.config.js           # (to be created)
│   └── tsconfig.json            # (to be created)
│
├── docs/                         # Documentation
│   ├── standalone_covert_call_plan.md  # ← BUILD REFERENCE (read this first!)
│   ├── architecture/            # System design docs, diagrams
│   ├── api/                      # Endpoint specifications
│   └── setup/                    # Development & deployment guides
│       └── GETTING_STARTED.md    # How to set up each component locally
│
├── README.md                     # Project overview & quick links
├── STRUCTURE.md                  # This file
└── CLAUDE.md                     # AI development instructions
```

## Folder Purposes

### `web/` — The Disguise UI
- Looks like a food-delivery app (QuickBite)
- Actually initiates a Gemini Live conversation (the real emergency reporting)
- Streams location data to backend
- Handles audio/text input from user
- Connects to backend via WebSocket for real-time updates

### `native/` — React Native Version
- Same core mechanism as web (for demo video credibility)
- Built AFTER web version is proven
- Enables future SOS sensor/mesh features (Phase 2)

### `backend/` — The Brain
- FastAPI server
- Manages incident lifecycle (create → update fields → end → consolidate)
- Orchestrates Gemini calls (conversation, extraction, consolidation, leakage-check)
- Manages Firestore (incident storage)
- Real-time WebSocket server (streams live updates to dashboard)

### `dashboard/` — The Responder Console
- Live incident list (sorted by urgency)
- Active call updates (populating field-by-field in real time)
- Incident detail view (once call ends)
- Map pin with location (GPS rough + confirmed address)
- Responder acknowledgment/resolution status

### `docs/` — Your Roadmap
- **`standalone_covert_call_plan.md`** is the single source of truth for scope/features/tech
- Architecture docs explain how pieces fit together
- API docs define contract between web/dashboard and backend
- Setup guides for local development

## What's Ready Now

✓ All 35 directories created  
✓ `.gitkeep` files in all subdirectories (structure preserved in git)  
✓ Top-level `README.md` (overview)  
✓ Top-level `CLAUDE.md` (AI instructions)  
✓ `GETTING_STARTED.md` (local dev setup)  

## What's Next

1. **Read** [`docs/standalone_covert_call_plan.md`](docs/standalone_covert_call_plan.md) (§1–7)
2. **Create** web app scaffold (`package.json`, `next.config.js`, entry page)
3. **Create** backend scaffold (`requirements.txt`, `main.py`, route stubs)
4. **Create** dashboard scaffold (same as web)
5. **Integrate** Gemini Live (web + backend)
6. **Build** WebSocket real-time plumbing (backend broadcast → dashboard subscribe)
7. **Test** full flow (disguised call → live dashboard → consolidation)

## Team Assignments

| Component | Owner | Status |
|-----------|-------|--------|
| Web app | ? | TBD |
| Backend | ? | TBD |
| Dashboard | Person B | Ready to start |
| Native app | ? | Phase 2 |

**Person B** — You have a clean `dashboard/` structure ready. Start with:
1. Next.js scaffold in `dashboard/`
2. Connect to backend WebSocket at `/ws/incidents/{id}`
3. Display live-updating incident card (person count, danger, urgency, location, voice stress)
4. Show consolidated summary once call ends
5. See `GETTING_STARTED.md` for local dev steps

## Important Notes

- **No implementation code yet** — only structure
- **All folders exist** and are git-tracked (via `.gitkeep`)
- **Read `docs/standalone_covert_call_plan.md` before starting**
- **Coordinate on WebSocket message format** (backend defines, web/dashboard consume)
- **API contract is a shared responsibility** (backend + web/dashboard must agree)

## Quick Commands

```bash
# From covert_call/ root:
cd web && npm install && npm run dev      # Start web app (port 3000)
cd backend && pip install -r requirements.txt && python src/main.py  # Start backend (port 8000)
cd dashboard && npm install && npm run dev # Start dashboard (port 3001)
```

---

**Build reference**: [`docs/standalone_covert_call_plan.md`](docs/standalone_covert_call_plan.md)  
**Setup guide**: [`docs/setup/GETTING_STARTED.md`](docs/setup/GETTING_STARTED.md)
