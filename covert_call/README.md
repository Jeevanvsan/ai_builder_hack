# QuickBite — AI Builder Cup 2026

A disguised food-delivery app that is actually an AI-powered emergency reporting and response system.

**Internal codename**: Covert Call mechanism  
**Public name**: QuickBite  
**Status**: Active prototype development for AI Builder Cup 2026

## Project Overview

QuickBite provides real-time emergency reporting and response coordination:
- **User side**: A convincing food-delivery UI that masks real emergency reporting
- **Responder side**: A real-time dashboard for coordinating emergency response
- **Core tech**: Gemini Live API for natural conversation + structured extraction, real-time websocket updates, location intelligence

Theme alignment: **Sustainability & Social Impact** (resilience strengthening, community support)

## Quick Links

- **Build plan**: [`docs/standalone_covert_call_plan.md`](docs/standalone_covert_call_plan.md)
- **Architecture**: [`docs/architecture/`](docs/architecture/)
- **API docs**: [`docs/api/`](docs/api/)

## Project Structure

```
covert_call/
├── web/                    # Next.js web app (primary deliverable)
│   ├── src/
│   │   ├── app/           # Next.js pages & routes
│   │   ├── components/    # React components
│   │   │   ├── disguise/  # Food-delivery UI components
│   │   │   ├── gemini/    # Gemini Live integration
│   │   │   └── responder/ # Responder dashboard
│   │   ├── lib/           # Utilities
│   │   │   ├── gemini/    # Gemini API helpers
│   │   │   ├── realtime/  # WebSocket/SSE handling
│   │   │   └── location/  # Location services
│   │   └── public/        # Static assets
│   ├── package.json
│   └── next.config.js
│
├── native/                 # React Native app (demo/future)
│   ├── src/
│   │   ├── screens/       # Native screens
│   │   ├── components/    # Shared components
│   │   └── lib/           # Native utilities
│   └── package.json
│
├── backend/               # FastAPI/Node backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models/        # Firestore data models
│   │   ├── middleware/    # Auth, logging, etc.
│   │   └── realtime/      # WebSocket/SSE server
│   ├── requirements.txt (or package.json)
│   └── main.py (or server.js)
│
├── dashboard/             # Responder dashboard (Next.js)
│   ├── src/
│   │   ├── app/           # Dashboard pages
│   │   ├── components/    # Dashboard UI
│   │   └── lib/           # Dashboard utilities
│   └── package.json
│
├── docs/                  # Documentation
│   ├── standalone_covert_call_plan.md  # Build reference
│   ├── architecture/      # System diagrams, data model
│   ├── api/               # Endpoint documentation
│   └── setup/             # Deployment, env setup
│
├── README.md              # This file
└── CLAUDE.md              # Claude AI instructions
```

## Getting Started

See [`docs/setup/`](docs/setup/) for:
- Local development setup
- Environment variables
- Running the web app + backend
- Deploying to Cloud Run/Firebase

## Tech Stack

| Component | Tech |
|-----------|------|
| Web app | Next.js, React, TypeScript |
| Native app | React Native |
| Backend | FastAPI or Node.js, Python/JavaScript |
| Database | Firestore |
| Real-time | WebSocket / Server-Sent Events |
| Gen AI | Gemini Live API (conversation + audio), Gemini API (structured output) |
| Location | Google Maps JavaScript API, Geocoding API |
| Hosting | Cloud Run, Firebase |

## Key Features

### Tier 1: Core Mechanism
- **Live disguised conversation** — Persona-driven natural interaction via Gemini Live
- **Silent tap-only fallback** — For no-connectivity or silent situations
- **Structured extraction** — Converts conversation to emergency data (people, danger, urgency, location)
- **Zero-trace exit** — Universal exit gesture with no visible state difference

### Tier 2: Second AI Reasoning Layer
- **Voice stress detection** — Analyzes pitch/pace/tone from Gemini Live audio
- **Post-extraction leakage check** — Redacts third-party exposure before responder sees report

### Tier 3: Originality Claims
- **Blind Relay** — Onion-encrypted mesh hops with timing jitter (if offline/mesh kept)
- **Private Space integration** — Hides in Android's native hidden space

### Tier 4: Real-time Response
- **Live dashboard updates** — Incident card populates field-by-field during call
- **Two-stage location** — Rough GPS pin → precise address via conversation
- **Post-call consolidation** — Coherent case summary replaces raw field log

## Development Checklist

- [ ] Web app initial setup (Next.js scaffold + basic pages)
- [ ] Backend server setup (FastAPI/Node)
- [ ] Gemini Live integration (connection + audio stream)
- [ ] Disguise UI (food-delivery form mock)
- [ ] Structured extraction (function calling)
- [ ] Real-time websocket infrastructure (backend + client)
- [ ] Responder dashboard (live incident view)
- [ ] Location services (GPS + Google Maps)
- [ ] Voice stress detection (Gemini audio analysis)
- [ ] Post-call consolidation (Gemini summary pass)
- [ ] Leakage check (redaction logic)
- [ ] Native app port
- [ ] Cloud Run deployment
- [ ] Demo video + deck

## Contribution Notes

- Follow Next.js and React best practices
- Keep components small and focused
- Maintain separation between disguise UI and backend logic
- All data flows through the real-time channel (no direct polling)
- Location must support both GPS and IP fallback

## Timeline

**4-week sprint** (Week 1–4) leading to Oct 18 submission.  
See `docs/standalone_covert_call_plan.md` §7 for detailed weekly breakdown.

## License

See [`LICENSE`](../LICENSE)

---

**For full context**, see:
- Root project: [`../CLAUDE.md`](../CLAUDE.md)
- Build plan: [`docs/standalone_covert_call_plan.md`](docs/standalone_covert_call_plan.md)
