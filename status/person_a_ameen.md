# Status — Person A: Ameen

**Role:** QuickBite disguise app — web (React/Vite) then React Native; Gemini Live conversation logic (owns Epic 1, Epic 2, Epic 6, sender half of Epic 7; shares Epic 5 with Jeevan)
**Last updated:** 2026-09-25 00:05 IST (maintained from Jeevan's side using merged PRs; Ameen, please correct or add your own progress)
**Live web app:** https://quickbite-5cde0.web.app

## Snapshot (as known on 2026-09-25)

| Epic | Status |
|---|---|
| Epic 1 — QuickBite disguise (core) | 🟡 Story 1.1 done (PR #3, merged); 1.2–1.5 not yet in the repo |
| Epic 2 — Second AI layer (stress detection, leakage check) | ❓ To be updated by Ameen |
| Epic 6 — Stretch: mesh relay | Not started (stretch, after core) |
| Epic 7 — Sender side (back-camera capture in native app) | Not started — shared publisher is ready (see below) |

## Done
- **Story 1.1: disguised home, cart and checkout** (PR #3 `web/disguise-home`, merged to `main`). Includes the React (Vite) web app in `covert_call/web/` (home with menu, categories, search and promo banner; item sheet; cart; checkout; `CallPage` placeholder for Story 1.2), food images with credits, and backlog 1.1 ticked.
- QuickBite web app deployed to Firebase Hosting (`quickbite-5cde0.web.app`, hosting only, so it doesn't touch Firestore rules or the dashboard site).
- _Ameen: add anything else, with dates._

## In progress / next
- _Ameen to fill in._

## Ready for Ameen (built by Jeevan, waiting to be wired in)
| What | Where | Backlog |
|---|---|---|
| Incident write client (create at call start, live fields, voice stress, address, end) | `covert_call/shared/incidents/client.ts` + `README.md` | 3.1, 3.2, 3.3 |
| Incident data model (single source of truth) | `covert_call/shared/incidents/types.ts` | — |
| Back-camera video publisher (free P2P WebRTC) | `covert_call/shared/video/publisher.ts` + `README.md` | 7.1 |
| Scripted call to see the dashboard react without the app | `npm run simulate-call` (from `covert_call/`) | — |

## What Jeevan (Person B) needs from Ameen
1. ~~Web app code in this repo~~ ✅ done in PR #3. Optional: add `"web"` to `workspaces` in `covert_call/package.json` (and remove `web/package-lock.json`) so web can import `shared/` with the same single Firebase copy as the dashboard. Needed once web starts using the shared incident client.
2. **Call `startIncident()` the moment a QuickBite session starts** (live call or silent tap), then `updateLiveFields()` / `recordVoiceStress()` from each Gemini Live function call, `confirmAddress()` when the "delivery address" question is answered, `endIncident()` on hang-up / zero-trace exit.
3. **Agree before changing the data model** (`shared/incidents/types.ts`) — the dashboard reads every field.
4. **Don't deploy Firestore rules from another folder** — `covert_call/dashboard/firestore.rules` is the only rules file.
5. **Billing decision** with the project owner — unblocks the post-call summary (3.4), Google Maps, and closed-tab notifications.

## Comments for Jeevan (Person B)
- _Ameen: add anything Jeevan needs to know here (blockers, API changes, questions)._
