# QuickBite AI test harness

Runs scripted test calls against Mia's real persona and tools, scores what reached the responder dashboard and
times each step. Everything runs locally; nothing here is deployed.

| Script | What it does |
|---|---|
| `npm run test:ai` (`run.ts`, `scenarios.ts`) | Plays every scenario as a real Gemini Live call. A second Gemini model plays the caller, with mocked GPS movement and sample camera frames and sounds from `media/`. Each call is written as a demo incident through the same `shared/incidents` client the app uses, so test calls stay out of the live queue. |
| `npm run report` (`report.py`) | Builds the Excel report (KPIs, per-check results, latency, cost, transcripts) from `results/latest.json`. |
| `npm run postcall` (`postcall.ts`) | Runs the app's post-call steps (case summary, leakage check, case linking) on test incidents. |
| `manual-report.ts` | Measures real calls made on the deployed app by incident ID, using only what the incident record holds. |
| `npm run resolve-tests` (`resolve.ts`) | Resolves test incidents as a responder so they leave the queue. |
| `npm run demo` (`demo.ts`) | Plays a sample camera clip or sound into a live call, for repeatable demos of scene detection. |

## Setup

```bash
cd covert_call/eval
npm install
npm run test:ai            # all scenarios
npm run test:ai -- <id>    # one scenario
npm run report
```

Keys come from `eval/.env.local` or `web/.env.local`: a Gemini key and the Firebase web config, plus a
responder login for `resolve-tests`. Results are written to `results/` (git-ignored). Media sources are credited
in [`media/CREDITS.md`](media/CREDITS.md).
