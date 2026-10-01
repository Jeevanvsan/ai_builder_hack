# Phase 4 spec: call intelligence, responder messaging, demo call, impact analytics

**Status:** agreed in planning on 2026-10-01 (Jeevan). **Ameen to review**, especially §1, which rewrites his persona.
**Backlog:** Epics 22–27 in [`backlog.md`](backlog.md) (Phase 4). Two existing items are promoted rather than duplicated: 21.2 (responder nudge), now Epic 23, and 21.1 (second-voice detection), now Epic 24.

**Goal of the whole phase:** get the most useful information about the caller's situation and the suspect in the least time, without breaking the disguise, and let responders talk back.

| # | Feature | Owner | Priority |
|---|---|---|---|
| 22 | Goal-driven persona (minimum facts, trigger-only follow-ups, time budget) | Ameen (persona), Jeevan (dashboard strip) | 1 |
| 25 | Hidden demo call | Ameen (web), Jeevan (dashboard exclusion) | 2 |
| 23 | Responder → caller covert messaging | Jeevan (dashboard), Ameen (live session) | 3 |
| 24 | Coercion detection | Ameen (persona/tool), Jeevan (flag) | 4 |
| 26 | Impact analytics: BigQuery sandbox + Looker Studio | Jeevan | Anytime, in parallel |
| 27 | Firebase AI Logic + App Check | — | **On hold** |

---

## 1. Goal-driven persona (Epic 22)

**Principle:** ask only what responders need to act and can't get another way. There is no fixed question script. Mia works from goals and picks each next question from the situation.

### 1.1 Minimum facts (always asked)
1. **Exact location, always asked, even with good GPS.** GPS has no floor or flat number, is often tens of metres off indoors, and sometimes is only the rough IP location.
   - Staying put: building, floor, flat, nearest landmark ("so the rider finds you").
   - Moving or chased: where they are right now, a landmark, and which way they're heading ("where should the rider meet you?"). This replaces the current Step 7 rule that skips the address when the caller is moving.
2. **What's happening:** one category question, using the existing codes.
3. **Immediate danger:** weapon or injury, combined into one question.

### 1.2 Follow-ups only when triggered

| Ask about | Only if |
|---|---|
| How many people | Danger is present and the headcount isn't clear from audio or camera |
| Suspect description, **number plate** | The caller is followed or chased, or the suspect has left |
| Can they get out | The caller is trapped, or inside with danger near |
| Injury details | An injury was reported |
| More address detail | GPS is poor, or it's a large building |
| Caller's name | The call is ending and there's time (optional) |

**Never ask:** anything already answered by the caller, the camera or the audio; "nice to know" details; anything once the caller goes quiet or says they need to go (wrap up straight away).

This replaces the current "aim for at least 4 follow-ups" drill-down in `persona.ts`.

### 1.3 Free versus fixed

| Free | Fixed (the system depends on these) |
|---|---|
| Wording, order, which questions, follow-ups, tone, combining questions | **Code meanings** stay as agreed in `shared/codes.ts` / `web/src/data/menu.ts`; the dashboard and coded menu decode them |
| Covert or open mode | The **meaning is said in the same sentence** as the code |
| | Nothing alarming is said aloud in covert mode |

### 1.4 Live "known facts" summary
Mia can only skip known facts if she knows them. `liveSession.ts` sends a short system note after each tool call, and whenever a camera or sound observation arrives. It uses the existing "(System note, not the caller: …)" pattern. Example:
> Known: location = Main Rd near market; danger = weapon (camera saw knife); people = 2. Still needed: can they get out?

### 1.5 Passive capture (no question needed)
- **Number plate from camera:** extend the scene-observation prompt to read any visible plate and report it, with a confidence level.
- **Suspect clothing and build from camera:** same tool.
- The existing passive signals stay as they are: GPS trail, voice stress, background sounds, scene, and the caller's estimated age and gender.
- **Plate handling:** decode the registering RTO offline from the prefix (e.g. `KL-04` = Alappuzha). **No owner lookup.** Owner details belong to VAHAN and authorised agencies only; scraping them would raise DPDP Act problems. The dashboard shows the plate so police can look it up legally.

### 1.6 Time budget (three phases)

| Phase | Target | Behaviour |
|---|---|---|
| 1. Critical facts | ≤ 60–90 s | Minimum facts (§1.1) |
| 2. Details and advice | to ~2–3 min | Triggered follow-ups, one or two safety tips |
| 3. Wrap up or stay | caller-led | Mia closes naturally ("your order will reach you in about 20 min") **unless** the caller is moving or chased, or a responder is actively guiding. **Never hang up automatically on a caller in danger.** |

- At about 2:30, Mia starts wrapping up unless the exception applies.
- The silent SOS is exempt, because nobody can hear it.
- After hang-up, the order-placed screen keeps sending location while it's open. (Check whether it does today.)

### 1.7 Dashboard (Jeevan)
- **Critical-info strip** at the top of the incident page: where, what, weapon, how many, suspect, plate. It fills in live.
- **Completeness meter:** "4 of 6 critical facts known".
- **Call timer** that turns amber at 3:00.
- Plate shown with its RTO region, plus a "same plate in other incidents" link, which ties into Epic 19's correlation.

### 1.8 Data model (agree before coding)
New optional fields on `extractedFieldsLive`: `vehicleNumber { value, confidence, source: 'caller' | 'camera' }` and `vehicleRegion`.

### 1.9 Rehearsal check (a free-form persona is harder to test)
Run 5 scenarios before the demo: chased; trapped indoors; hurt; reporting for someone else; open mode. Check that Mia:
- **never skips the location question**
- **never repeats a question**
- **asks no question the camera or audio has already answered**
- **keeps calls ≤ 3 min** unless the caller is moving

---

## 2. Responder → caller covert messaging (Epic 23, promotes 21.2)

- **Dashboard:** a "Message caller via Mia" box on the live incident page, with quick buttons (*Stay hidden*, *Help is X min away*, *Move to a public place*, *Stay on the line*) plus free text.
- **Storage:** `incidents/{id}/messages`, each `{ text, sentBy, sentAt, deliveredAt?, spokenAs? }`. Only signed-in responders can create one. Status only moves forward.
- **Live session:** listens for new messages and injects each one as a system note on Mia's **next turn**. Mia never interrupts the caller.
- **Mia's job:** reword the message as delivery chat. *"Stay hidden, help 5 min away"* becomes *"Your rider is 5 minutes away, please wait inside."* She then calls `confirm_message_delivered` with what she actually said.
- **Feedback:** the dashboard shows "✓ Delivered" and the exact wording.
- **Guardrail:** if a message can't be disguised safely ("police are coming"), Mia delivers only the safe part and reports what she left out.

## 3. Coercion detection (Epic 24, promotes 21.1)

- **What Mia listens for:**
  - a different voice taking over
  - a sudden flat or scripted tone ("everything's fine, cancel")
  - whispered asides
  - someone else answering
- **Reporting:** a new tool, `report_coercion_signal { kind, detail, confidence }`. Mia **never reacts aloud**, keeps the order story going, and can quietly extract more from the second speaker.
- **Dashboard:** a red "Possible coercion" flag in the timeline. A high-confidence signal raises severity.
- **Rule:** a "cancel, it was a mistake" after danger signals **does not close** the incident. It stays open and flagged.
- **Before committing (from 21.1):** prototype with a staged second-voice test call. Cut the feature if detection is unreliable; a confident false alarm is worse than none.

## 4. Hidden demo call (Epic 25)

- **Trigger:** **long-press the QuickBite logo (~2 s)** in the top bar. A short press does nothing unusual. The heart double-tap stays the silent SOS.
- **Behaviour:** the full real call (Mia, the codes, camera, extraction), clearly the same experience. The difference is that the incident is written to a **separate `demoIncidents` collection** with `isDemo: true`. Live queue, history, analytics, AI insights, alerts and sirens never read it.
- **End of call:** a **"What the responder would see"** card on the phone: extracted facts, severity, voice stress and the transcript. Testers see the result without dashboard access.
- **Limits:** demo calls still use Gemini quota. Add a light per-device limit (e.g. 3 per hour) to protect it.
- **For judges:** document the gesture in the README and deck ("Long-press the QuickBite logo to try a demo call").
- **Rules:** `demoIncidents` gets its own simple rules; nothing in it is readable as a real incident.

## 5. Impact analytics: BigQuery sandbox + Looker Studio (Epic 26)

- **Free tier, no billing:** BigQuery sandbox (10 GB storage, 1 TB queries/month) plus Looker Studio.
- **Load:** a local script (`npm run export:bq`) reads incidents through the existing admin path and writes an **anonymised** table, then loads it into BigQuery. No Cloud Functions are needed, which is why it stays free.
- **Anonymised means:** ~1 km grid cell (not the address), hour, weekday, severity, channel, danger categories, time to acknowledge and time to resolve. **No** names, notes, transcripts, exact addresses or plates.
- **Report:** a public Looker Studio report covering incidents by area, hour and day, the response-time trend and the channel mix. Linked from the landing page and the deck.
- **Re-run:** before the demo, and whenever new data matters (manual; there's no cron without billing).

## 6. Firebase AI Logic + App Check (Epic 27): ON HOLD

Moves Gemini calls off public API keys (today `VITE_GEMINI_*` keys ship in the public JS). It's on hold by decision. Until it's picked up, restrict each key in Google Cloud Console to the Generative Language API and the app's HTTP referrers as a stopgap.

---

## Native parity
Native now has its own call flow (`native/src/lib/gemini/liveSession.ts`, `CallScreen`, `SosScreen`), and it **imports the persona and tool declarations from web**.
- **Automatic on native:** changes to `web/src/lib/gemini/persona.ts` and `tools.ts` (§1 goals and triggers, §3's new tool declaration).
- **Must be mirrored in `native/src/lib/gemini/liveSession.ts`:** anything added to web's `liveSession.ts`. That means the known-facts summary (§1.4), the messaging listener (§2), handling `report_coercion_signal` (§3), and writing demo calls to `demoIncidents` (§4).
- **Native Home:** needs the same logo long-press trigger (§4).
