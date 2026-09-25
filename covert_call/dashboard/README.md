# QuickBite Monitoring Dashboard

The response team's app (Epic 4). It's separate from the QuickBite web app: its own build and its own Firebase Hosting site in project `quickbite-5cde0`. It uses React + Vite + TypeScript with a light theme and a layout built for large monitors.

## Run locally

Copy `.env.example` to `.env.local` and fill in the Firebase values (`npx firebase-tools apps:sdkconfig WEB --project quickbite-5cde0` prints them). `.env.local` is gitignored.

```bash
cd ..              # packages install once for the whole covert_call workspace
npm install
cd dashboard
npm run dev        # http://localhost:5174
```

Routes: `/` (live queue), `/incident/:id` (incident detail), `/incident/:id/video` (full-screen camera feed), `/history` (resolved cases). Dev-only: `/dev/camera` streams this device's camera into an incident to test the video feed. All data comes live from the Firestore `incidents` collection (typed in `src/lib/types.ts`).

## Data and live demo

```bash
npm run deploy:rules   # deploy firestore.rules (no deletes, validated fields, forward-only status; no auth yet)
npm run seed           # add any missing seed incidents (existing ones are left alone)
npm run seed -- --reset  # delete ALL incidents via the Firebase CLI (your login), then write the seeds fresh
npm run simulate-call  # play a scripted 30s call through shared/incidents/client.ts: open /incident/<id> and watch it update live
```

The incident map uses Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set in `.env.local` (not committed), and falls back to OpenStreetMap (free, no key) otherwise.

## Deploy (Firebase Hosting, second site)

The dashboard is hosted as a second site, `quickbite-5cde0-dashboard`, inside the same Firebase project as the web app (https://quickbite-5cde0.web.app).

First-time setup (this needs a browser sign-in):

```bash
npx firebase-tools login
npx firebase-tools hosting:sites:create quickbite-5cde0-dashboard --project quickbite-5cde0
```

Every deploy after that:

```bash
npm run deploy     # builds, then deploys --only hosting:dashboard
```

Live URL: https://quickbite-5cde0-dashboard.web.app

`firebase.json` has an SPA rewrite so direct loads of `/history` and `/incident/:id` work.
