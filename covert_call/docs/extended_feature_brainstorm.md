# Extended Feature Brainstorm — 911-Inspired Enhancements

Source material: `docs/extended_video_transcripts.md` (three YouTube Shorts clips of dramatized 911 calls —
the hotel-booking abduction call, the pizza-call domestic incident, and the "Peter, no" witty-operator clip).
This doc captures what those transcripts suggest we're missing against `covert_call/docs/backlog.md`, plus
separate UI/GenAI "wow factor" ideas raised in the same discussion.

**Status: brainstorm only, nothing here is built or committed to a phase yet.** Each feature below is written to
be handed straight to whoever builds it — problem, what to build, where it plugs into the existing codebase, and
what "done" looks like — but sizing/priority against the remaining time budget still needs a decision before any
of this goes into `backlog.md` as real stories.

**Explicitly rejected, do not build**: a "deep search a named person, pull matching photos/public records to
identify a culprit" feature was proposed and rejected. No compliant/free data source exists for this — it's the
exact product category (Clearview-style face search) that has been banned and litigated elsewhere. Real risk of
misidentifying an innocent person during a live crisis, and it contradicts the project's own "identity never
captured for third parties" design posture. Left out of this document entirely except for this note.

---

## Quick wins (prompt / small-code changes, low risk)

### 1. Presence-filling chatter during pauses

**Problem:** real 911 operators keep talking during ordinary pauses, not just after prolonged silence — "Catherine,
I know you're afraid right now, but I'm right here with you." Our persona currently only reacts to silence via the
3-strikes escalation (`liveSession.ts`'s silence watchdog, ~8s of quiet triggers a re-ask). A caller who pauses for
a couple of seconds mid-thought gets nothing back, which can read as the AI going dead rather than listening.

**What to build:** a short reassurance line ("still here, take your time," phrased however fits the current
disguise wording) that Mia can naturally drop in during a normal pause — a couple of seconds, well short of the
silence-watchdog's 8s threshold. This is tone guidance, not new tooling: add an instruction to `persona.ts`
describing when this is appropriate (a caller trailing off mid-sentence, a long pause after a hard question) and
how to phrase it so it stays in the order-taking disguise ("no rush, take your time with the order").

**Where it plugs in:** `covert_call/web/src/lib/gemini/persona.ts` only. No changes to `liveSession.ts`'s silence
watchdog — this is a distinct, softer behavior that happens *before* that logic would ever fire.

**Done looks like:** during a live test call, pausing mid-answer for 2-4 seconds gets a short in-character
reassurance from Mia, without triggering the "no response" tracking or feeling like a repeated question.

---

### 2. Guess-and-confirm fallback mode

**Problem:** the hotel-call transcript shows the operator switching tactics when the caller can barely speak —
instead of offering "pepperoni, spicy, or garlic bread," she states a specific guess ("if he's armed with a gun,
ask for a king-size bed") and only needs a yes. That's faster and safer for someone who can only manage one
strained word at a time. Our current persona always offers 2-3 options and waits for the caller to pick — more
cognitive load than someone in real distress may be able to handle.

**What to build:** an instruction in `persona.ts` for a fallback mode: when the caller's answers are getting
shorter, quieter, or more strained (inferred from response length in the transcription, or from voice stress
crossing a threshold if that data's available to reason about), switch from "pick one of these options" to
"here's my best guess, just say yes or no" — using whatever the caller's own last answer suggested. This should be
framed as a *degradation path* the model chooses to use, not a separate call flow — it re-uses the same coded
vocabulary, just phrased as a guess instead of a menu.

**Where it plugs in:** `persona.ts`, added as a rule alongside RULE 2 and RULE 3 (options-only, keep it easy to
answer). No new tools needed — `report_situation` calls work the same either way.

**Done looks like:** in a rehearsed test call where the tester deliberately answers in short, quiet single words,
Mia's questions visibly shift from 2-3-option menus to single-guess yes/no confirmations within a round or two.

---

### 3. Dropped-call handling

**Problem:** none of the transcripts show a hang-up, but it's the single most common real-world failure mode for
an emergency call — network drops, the phone locks, the battery dies, the caller is physically stopped mid-call.
Right now, `liveSession.ts`'s `onclose` callback just calls `callbacks.onStatusChange('ended')` with no
distinction between a clean `end_call` (Mia said goodbye, caller confirmed) and the WebSocket just dying. Whatever
was mid-report at that moment (e.g. a `report_situation` call that hadn't fired yet) is simply lost, and the
incident record looks identical to a calm, resolved call.

**What to build:**
- Track whether the call ended via the `end_call` tool path (already has `finished = true` set explicitly in
  `liveSession.ts`) versus via `onclose` firing without that flag having been set — the latter is an unexpected
  disconnect.
- On an unexpected disconnect, still run `consolidateCall()` / `runLeakageCheck()` in `CallPage.tsx`'s
  `finishCall()` with whatever's already on Firestore (this already happens today regardless of end reason — the
  gap is that nothing *marks* the incident as having ended abnormally).
- Add a `callEndReason: 'confirmed' | 'dropped' | 'silence-timeout'` field (or similar) to
  `Incident['callState']`-adjacent data in `shared/incidents/types.ts`, set by `endIncident()` in
  `shared/incidents/client.ts` based on which path triggered it.
- Dashboard: show a distinct visual treatment for a dropped call on the incident detail page (e.g. a red "Call
  dropped — not confirmed ended" banner instead of the calm "Case record" banner) and treat it as its own signal
  feeding into severity — a call that cuts out mid-danger-report is arguably scarier than one that resolves
  normally, so `deriveSeverity()` in `shared/incidents/severity.ts` should account for this.

**Where it plugs in:** `liveSession.ts` (track end reason), `shared/incidents/client.ts`'s `endIncident()` and
`shared/incidents/severity.ts` (new field + severity input), `shared/incidents/types.ts` (schema addition),
`dashboard/src/pages/incident/IncidentDetailPage.tsx` (visual treatment).

**Done looks like:** killing the mic/network mid-call (or force-closing the tab) during a test results in an
incident marked as dropped, not ended, visibly different on the dashboard, with severity reflecting the
abnormal cutoff.

---

### 4. Bystander-witnessing-live-event scenario code

**Problem:** our existing Round 1 "for someone else" category "family combo" (witnessed a crime) reads as
past-tense/one-off — "I saw a theft." Real dispatch calls often come from someone watching something happen to a
third party *right now* — through a window, overhearing a neighbor. That's a distinct case: it changes what's
useful to ask (can you still see them, is anyone else outside, which unit/floor) versus what a past-tense witness
report needs.

**What to build:** a new Round 1 disguised code distinct from "family combo," specifically for an ongoing
third-party observation, with its own Round 2+ drill-down questions (still happening / can still see or hear them
/ which direction / which floor or unit). Written into `persona.ts` following the exact same same-breath-meaning
pattern as the existing 13 codes.

**Where it plugs in:** `persona.ts`'s Step 4 (What is happening) and Step 5 (drill-down) sections only.

**Done looks like:** a test call describing "I can see my neighbor's argument through the window right now" gets
routed to genuinely relevant follow-up questions (is it still happening, can you still see them) rather than the
past-tense witnessed-crime questions (how many people, was it today or earlier).

---

### 5. Situationally-anchored safety advice

**Problem:** backlog Epic 10.4 (short, direct safety advice) is currently scoped as generic canned lines ("stay
away from windows," "apply pressure to a wound"). The pizza-call transcript shows advice anchored to what's
actually being described in that specific call — "move as far away from the door as you can," "can you tell me if
he's facing the door" — spatial, situational, not a fixed list recited regardless of context.

**What to build:** tighten Epic 10.4's scope so the persona instruction explicitly ties advice to details already
gathered in that call (the caller's own described environment — near a door, in a specific room, a specific
injury) rather than picking from a fixed set. This is a scope/prompt refinement to an already-planned story, not
new infrastructure.

**Where it plugs in:** whichever persona instructions get written for Epic 10.4 when that story starts — flag this
requirement before that work begins, not as a separate feature.

**Done looks like:** Epic 10.4's eventual advice-giving instructions explicitly require referencing details
already reported in that specific call (via the same `adviceGiven[]` tool logging already planned).

---

### 28. Keyboard-driven "next most urgent" hotkey

**Problem:** a responder triaging several open incidents has to click into the queue and visually scan for the
highest-priority unacknowledged case every time they finish with one — even though the ranking logic that would
tell them exactly which one that is already exists (`dashboard/src/lib/ranking.ts`, used to order Epic 4.2's live
queue).

**What to build:** a single keybind (e.g. spacebar or `N`) available anywhere in the dashboard that jumps straight
to whichever open, unacknowledged incident currently ranks highest, using the exact same ranking function the
queue view already sorts by — no new prioritization logic, just a shortcut to navigate to its result. A small
non-intrusive UI hint (e.g. a shown-once tooltip or a corner label) so a responder discovers the shortcut exists.

**Where it plugs in:** a global keydown listener (likely in the dashboard's top-level layout/`App.tsx`), reusing
`dashboard/src/lib/ranking.ts`'s existing sort output and navigating via `react-router-dom` to that incident's
detail page.

**Done looks like:** with several open test incidents at different severities, pressing the hotkey from anywhere
in the dashboard jumps directly to the same incident that sits first in the live queue's own ranking.

---

## Medium effort, strong technical-merit story

### 6. Re-alert on material change

**Problem:** Epic 4.6 (audible/visual alerting) currently alerts responders once, when an incident is first
created. After that, field updates happen silently in the live-updating card UI (Epic 3.2) — a responder who's
glanced away won't be re-notified when, say, a weapon gets confirmed 40 seconds into a call they're not actively
watching.

**What to build:** distinguish "a new fact was added" from "the situation just materially changed" — specifically:
address confirmed for the first time, a new dangerIndicator added after the incident was already at least
medium severity, or urgency escalating to a higher level than previously recorded. On any of these, re-trigger the
same alert path Epic 4.6 already built for new incidents (toast + siren-style sound + tab title count), scoped to
responders who aren't currently on that incident's detail page (the existing "do not disturb while on an incident
page" rule from 4.6 should still apply).

**Where it plugs in:** `dashboard/src/lib/` wherever Epic 4.6's alert logic lives — needs a way to diff the
previous vs. new field state per incident (Firestore's real-time listener already gives both old and new snapshot
data) and decide "is this a material change" before deciding whether to re-fire the alert.

**Done looks like:** during a live test call, a responder who's on the live queue (not the detail page) gets a
second alert when a weapon indicator is added mid-call, distinct from the initial "new incident" alert.

---

### 7. Cross-incident correlation

**Problem:** a real dispatcher cross-references a name/vehicle against records instantly (the hotel-call transcript
does this against DMV data). We have no equivalent for our own incidents — if the same address, vehicle
description, or name string shows up across two separate reports, nothing surfaces that connection today.

**What to build:** at consolidation time (`CallPage.tsx`'s `finishCall()`, alongside the existing
`consolidateCall()` / `runLeakageCheck()` calls), add a pass that checks the new incident's confirmed address,
any vehicle description in `notes`/`dangerIndicators`, and any name mentioned, against other open or recent
incidents already in Firestore. This stays entirely inside data we already legitimately hold — no external
lookups, no identity resolution, just string/fact matching across our own incident records. A simple approach:
pull the last N incidents (or open ones), pass their key fields plus the new incident's fields to a client-side
Gemini text call (same pattern as `consolidate.ts`/`leakageCheck.ts`) asking "do any of these appear to describe
the same person, vehicle, or location as this new report?" with structured JSON output.

**Where it plugs in:** a new file alongside `consolidate.ts`/`leakageCheck.ts` (e.g.
`web/src/lib/gemini/correlate.ts`), writing a new field (e.g. `correlatedIncidentIds: string[]`) to the incident
record via a new `shared/incidents/client.ts` function. Dashboard: a small "Possibly related" card on the incident
detail page linking to matched incidents.

**Done looks like:** two test incidents seeded with the same address or vehicle description show a "possibly
related" link to each other once consolidation runs on the second one.

---

### 8. Nearby police / fire / rescue stations with contacts

**Problem:** once an incident's location is confirmed, a responder still has to manually look up which police
station, fire station, or hospital is actually closest before dispatching anyone — there's no assistance for that
step today, even though we already have the confirmed coordinates.

**What to build:** once `location.confirmed` exists on an incident, query nearby police stations, fire stations,
and hospitals using either the free OpenStreetMap Overpass API (consistent with the project's existing
free-tier-first pattern used for Nominatim geocoding) or Google Places Nearby Search if a Places-enabled key is
ever configured. Show results as cards on the incident detail page: name, approximate distance, and phone number
where available, with a "Call station" button (a plain `tel:` link, no telephony integration needed). Optionally,
auto-suggest which type of service to lead with based on the incident's `dangerIndicators`/urgency — a weapon or
threat indicator suggests police first, smoke/fire indicators suggest fire service, an injury indicator suggests
hospital/ambulance — surfaced as a simple ordering or highlight, not a hard rule.

**Where it plugs in:** a new function in `shared/incidents/geocode.ts` or a sibling file (e.g. `nearbyServices.ts`)
following the existing Nominatim/Overpass free-tier pattern, called once `location.confirmed` is set (either from
`confirmAddress()` in `shared/incidents/client.ts`, or lazily on the dashboard when the detail page loads). New
card component on `dashboard/src/pages/incident/IncidentDetailPage.tsx`.

**Done looks like:** opening a test incident with a confirmed address shows a card listing at least one real
nearby police station and hospital with a working phone link, without needing a paid API key.

---

### 9. Google Search grounding for non-personal facts

**Problem:** contextual facts that would help a responder judge the situation — current weather, road conditions
near the incident — aren't available anywhere in the current pipeline.

**What to build:** use Gemini's Search grounding tool (available on the free tier for `@google/genai` text calls,
same client already used for `consolidate.ts`/`leakageCheck.ts`) narrowly scoped to factual, non-personal
lookups: weather conditions near the confirmed location, or a sanity check that an address corresponds to a real,
plausible location. This is explicitly **not** for looking up any person by name — scope this function's prompt
tightly enough that it can't be repurposed for that (e.g. only ever pass coordinates/an address string, never a
person's name, into the grounded query).

**Where it plugs in:** a small addition to the consolidation pass or a standalone helper, called once location is
confirmed. Low priority relative to 6-8 — genuinely nice-to-have context, not a core capability gap.

**Done looks like:** a test incident's consolidated summary or detail page shows a one-line grounded fact (e.g.
current weather near the location) sourced from a real Search grounding call, not a hardcoded value.

---

### 10a. Live AI reasoning trace panel

**Problem:** the dashboard shows *outputs* (fields, severity, chips) but never *why* the AI arrived at them — it
reads as a form being filled in, not a system reasoning about a situation. This is a direct, visible way to
counter the exact failure mode called out in the project's own scope notes: "a chatbot wrapper loses on technical
merit even with a good cause." A judge watching a black box fill in fields sees a form; a judge watching the
reasoning appear sees a system.

**What to build:** a small live-updating panel on the incident detail page showing short, plain-language reasoning
lines as they happen — e.g. "Urgency raised to HIGH — weapon reported 12s ago, voice stress crossed 75" — derived
from the same inputs `deriveSeverity()` already consumes (dangerIndicators, urgency, voiceStressScore) plus a
timestamp and a one-line cause. Since severity/urgency changes already happen at specific, identifiable moments
(a `report_situation` or `report_stress_level` tool call updating a field), each such update is a natural trigger
to also append one reasoning-trace line — no separate Gemini call needed, this can be a deterministic
"what changed and why" description generated at write-time in `updateLiveFields()`/`recordVoiceStress()`.

**Where it plugs in:** `shared/incidents/client.ts`'s `updateLiveFields()`/`recordVoiceStress()` (append a short
reasoning string to a new `reasoningTrace[]` array whenever severity or urgency actually changes, not on every
write), `shared/incidents/types.ts` (new field), new dashboard component rendering it as a live-scrolling feed
next to or under the extracted fields card.

**Done looks like:** during a live test call, as urgency escalates, a new line appears in the reasoning panel in
real time explaining what triggered the change, without a responder having to infer it from raw field values.

---

### 10b. Animated confidence dial

**Problem:** `fieldConfidence` (confirmed/inferred/uncertain per field, written by `consolidateIncident()`) exists
today but only as a static badge next to each field (the `Confidence` component in `IncidentDetailPage.tsx`). It
doesn't convey the live *process* of a field sharpening from unknown to confirmed as the call progresses — turning
this into a visual, moving element makes the AI's work visible during the call itself, not just after
consolidation.

**What to build:** an animated dial, bar, or similar visual per key field (or one overall dial) that moves as
confidence changes during the live call — from "uncertain" through "inferred" to "confirmed" — rather than a
static text badge that only ever shows the current state. Since `fieldConfidence` today is only populated at
consolidation (call-end), this requires a live-confidence concept during the call too: the simplest approach is to
derive a live confidence level directly from whether a field has been reported once (inferred) vs. reported
consistently or explicitly confirmed (e.g. `confirm_address` specifically marks address as confirmed, while a
single `report_situation` danger indicator starts as inferred and could be upgraded if repeated or elaborated on
in a later round).

**Where it plugs in:** extends the existing `fieldConfidence`/`Confidence` pattern in
`dashboard/src/pages/incident/IncidentDetailPage.tsx` to update live during a call, not just after consolidation;
touches `shared/incidents/client.ts`'s `updateLiveFields()` to also set a live confidence level per field it
writes.

**Done looks like:** during a live test call, a field's confidence visual visibly moves (e.g. from a dim/grey
"uncertain" state to a solid "confirmed" state) as Mia gathers more detail about it, rather than sitting static
until the call ends.

---

### 12. Decision-support recommendation line

**Problem:** severity today (`deriveSeverity()` in `shared/incidents/severity.ts`) is a single low/medium/high/
critical value derived from danger indicators, urgency, and voice stress. That's a good triage signal, but it
stops short of telling a responder what to actually *do* — it's an extraction/scoring system, not yet a decision
support system.

**What to build:** alongside the existing severity computation, derive one additional short recommendation
sentence — e.g. "Recommend immediate police dispatch" vs. "Recommend monitoring, no immediate dispatch needed" —
based on the same inputs `deriveSeverity()` already has (dangerIndicators, urgency, voiceStressScore), plus
whichever service type feature 8 (nearby stations) would auto-suggest. This can be a simple rule-based mapping
alongside `deriveSeverity()` rather than a separate Gemini call — keep it deterministic and explainable, which
also strengthens feature 10 (reasoning trace) below.

**Where it plugs in:** `shared/incidents/severity.ts`, exposing a new derived value alongside severity. Rendered
prominently on the dashboard's incident detail page, near the severity chip.

**Done looks like:** an incident with a weapon indicator and high urgency shows a clear "Recommend immediate
police dispatch" line, not just a "HIGH" severity chip a responder has to interpret themselves.

---

### 20. Distinct escalation audio cue for incidents already being watched

**Problem:** Epic 4.6 already covers a repeating siren for new/unactioned incidents, and feature 6 (re-alert on
material change) covers re-notifying a responder who's *not* currently looking at an incident. Neither covers the
case of a responder who is *already* on that incident's detail page when severity jumps mid-call — right now
they'd only notice if they happen to be looking at the severity chip at that exact moment.

**What to build:** a short, distinct sound (not the same siren used for new/unactioned incidents — a sharper,
one-shot "escalation ping") that fires the instant severity increases on the incident currently open in front of
the responder. This deliberately does *not* respect the existing "do not disturb while on an incident page" rule
from Epic 4.6, since that rule exists to avoid interrupting a responder working a *different* incident — here the
responder is already on the exact incident that just escalated, so the interruption is the point.

**Where it plugs in:** `IncidentDetailPage.tsx`, watching for a severity increase in the same real-time Firestore
snapshot it already subscribes to, playing a short distinct audio cue (a second, separate sound asset from
whatever Epic 4.6 already uses for its siren).

**Done looks like:** during a live test call, a responder with the incident detail page already open hears a
distinct sound the instant severity increases, without needing to be watching the screen.

---

### 21. "Golden thread" replay scrubber for consolidated cases

**Problem:** once a call ends and gets consolidated, a responder reviewing it later only sees static fields, a
summary paragraph, and a separate stress sparkline — reconstructing "what was happening at any given moment" means
manually cross-referencing the transcript against the stress trend by eye. There's no way to scrub to a moment in
time and see everything that was true then, together.

**What to build:** a timeline scrubber on the incident detail page (shown once a case is consolidated) that lets a
responder drag to any point in the call's duration and see, in sync: the transcript at that moment, whichever
fields had been extracted by then, and the voice-stress value at that instant. This needs every displayed thing to
carry a timestamp it doesn't fully have yet today — the transcript in particular isn't currently written to
Firestore with per-line timestamps (see feature 15's note that transcript lines are only held locally in
`liveSession.ts` until call-end); this feature and feature 15 share the same underlying gap and should likely be
solved together (timestamped transcript lines, written live, are useful for both the live annotated view and this
post-call scrubber).

**Where it plugs in:** requires timestamped transcript persistence (a new subcollection or array field written
progressively during the call, from `liveSession.ts`'s `appendTranscript()`), plus a new scrubber UI component on
`IncidentDetailPage.tsx` reading that data alongside the existing `voiceStressTrend` array (which already carries
timestamps) and `extractedFieldsLive`'s update history (would need field-level update timestamps too, which
aren't currently tracked — only the current value is stored, not a history of when each value changed).

**Done looks like:** on a consolidated test case, dragging the scrubber to the midpoint of the call shows the
transcript up to that point, the stress value at that instant, and only the fields that had been extracted by
then — not the full final picture.

---

### 22. Dispatch-bulletin-formatted briefing card

**Problem:** the post-call consolidation summary (`consolidate.ts`) currently outputs a prose paragraph. Real
dispatch communication (as in the hotel-call transcript's "LAPD be advised... unknown vehicle heading to Sunset
Regency Hotel... have units waiting to intercept") is terse, structured, and immediately scannable — a different
register than a narrative summary, and a stronger signal of genuine domain understanding.

**What to build:** change `consolidate.ts`'s structured output schema to also produce a rigid bulletin-style
block alongside (or instead of) the prose summary — fixed fields like LOCATION / SUBJECTS / WEAPONS / VEHICLE /
STATUS / RECOMMENDED ACTION (the last one reusing feature 12's decision-support line), each a short fragment, not
a sentence. Render it on the dashboard in a monospace, bulletin-styled card, visually distinct from the softer
prose summary.

**Where it plugs in:** `web/src/lib/gemini/consolidate.ts`'s `responseSchema` (add the structured bulletin fields
alongside the existing `consolidatedSummary`/`fieldConfidence` output), `shared/incidents/types.ts` (new field for
the structured bulletin), a new styled card component on `IncidentDetailPage.tsx`.

**Done looks like:** a consolidated test case shows both the existing prose summary and a separate, terse,
bulletin-formatted card reading like a real dispatch broadcast.

---

### 23. "What changed since you last looked" diff banner

**Problem:** a responder re-opening an incident they'd already viewed once has to re-scan every field to spot
what's new since their last visit — there's no summary of just the delta, even though `response.viewedAt` already
tracks when they last looked (Epic 4.6).

**What to build:** on reopening an incident, compare the current field state against a snapshot taken at the
responder's last `viewedAt` timestamp, and show a small banner summarizing just the changes — e.g. "Since you last
checked: address confirmed, urgency raised to high, 2 new notes." This requires keeping a lightweight snapshot of
field state at each view (or at minimum, at each material-change point from feature 6), not just the current
values, since a diff needs both an old and a new state to compare.

**Where it plugs in:** likely needs a small history mechanism — either a snapshot written alongside
`response.viewedAt` updates, or reusing whatever change-tracking feature 6 (re-alert on material change) ends up
building, since both need to answer "what changed and when." Worth designing these two together rather than
separately. New banner component on `IncidentDetailPage.tsx`.

**Done looks like:** a responder who viewed an incident, left, and returns after new fields were reported sees a
clear one-line summary of exactly what changed, instead of having to compare the whole field list from memory.

---

### 26. Callback-attempt status on unexpected disconnect (try once, not a full auto-dial system)

**Problem:** real 911 protocol attempts a callback the instant a call drops unexpectedly. Feature 3 (dropped-call
handling) already covers detecting and flagging an unexpected disconnect, but stops at marking the incident —
nothing mirrors the callback step itself.

**What to build, scoped deliberately small — try this once, don't build a retry system:** no real outbound
telephony is in scope (no budget, no telephony integration exists anywhere in this project). Build only the
*status representation* of a callback attempt: the instant a dropped call is detected (feature 3), show a
dashboard status of "Attempting callback..." for a short fixed window, then resolve to either "Callback
unavailable — no return channel" (the honest, permanent state, since there's no real phone number/channel to call
back on in this web-based flow) or, if the underlying disguise app happens to still be open in the caller's
browser tab, a real reconnect could theoretically be attempted via the same `startLiveCall()` path — but that's a
meaningfully bigger feature than what's being asked for here. Keep this to the honest, simple version: a status
label that mirrors real-world dispatch behavior for realism in the demo, without overclaiming an actual callback
capability that doesn't exist.

**Where it plugs in:** `IncidentDetailPage.tsx`'s dropped-call banner (from feature 3), showing a short-lived
"Attempting callback..." state before settling to its final status text. No new backend logic needed beyond a
timed UI state change.

**Done looks like:** a test incident marked as dropped shows a brief "Attempting callback..." status before
settling into its final dropped-call state — a realistic protocol touch, not a functioning callback system.

---

### 32. One-click "share incident summary" for external handoff

**Problem:** everything a responder learns currently lives inside the dashboard itself. There's no way to get a
clean version of what's known out to whoever is physically being dispatched — reading fields off a screen aloud
over a police radio, or pasting into another system, is clumsy and error-prone under time pressure, and nothing
today is formatted for that use.

**What to build:** a single button on the incident detail page that generates a clean, copyable/printable version
of the current brief, reusing feature 22's dispatch-bulletin format (LOCATION / SUBJECTS / WEAPONS / VEHICLE /
STATUS / RECOMMENDED ACTION) rather than inventing a second format. "Copy to clipboard" is the simplest version;
a plain browser print stylesheet (`window.print()` with a dedicated print CSS view, not a custom PDF pipeline) is
a reasonable stretch if time allows. This should reflect the *current* state of the bulletin at the moment it's
generated — live incidents will keep changing, so this is a point-in-time snapshot for handoff, not a
continuously syncing document.

**Where it plugs in:** builds directly on feature 22's structured bulletin fields (`consolidate.ts`'s schema
addition, or, for a still-live incident, the same fields already present in `extractedFieldsLive` formatted the
same way) — a new button/component on `IncidentDetailPage.tsx`. No new backend data needed if 22 exists first;
worth building in the order 22 → 32.

**Done looks like:** clicking the button on a test incident copies (or prints) a clean, radio-readable bulletin
of the current known facts, usable by someone who never looks at the dashboard itself.

---

### 33. Inline map-based direction/perimeter annotation

**Problem:** the persona's own "MOVING?" drill-down (in `persona.ts`'s Step 5) already gathers landmarks and
direction-of-travel specifically for a possible-abduction scenario, on the reasoning that the confirmed address
alone goes stale the moment someone is being moved. Today, every one of those landmarks only ever lands as a text
note or a repeated `confirm_address` call — there's no visual trail on the map at all, even though the map
component (`IncidentMap.tsx`, Epic 4.3) already renders the confirmed/rough location pins.

**What to build:** let a responder (or, more ambitiously, have the system auto-plot) a simple direction arrow or
a rough path line on the incident's map as new landmark/address updates come in during a moving/abduction-flagged
call, so the pattern of movement is visually legible at a glance instead of buried in a growing list of address
strings and notes. The simplest version is fully manual: a responder clicks/drags on the map to mark a direction
or waypoint as they read new landmarks off the notes feed. A more automatic version would plot each successive
`confirmAddress()` call's coordinates as a connected path automatically, which requires geocoding every
intermediate landmark mention (not just the final address), a heavier lift than the manual version.

**Where it plugs in:** extends `dashboard/src/components/IncidentMap.tsx` with an annotation layer (most map
libraries — Leaflet for the free OpenStreetMap path already in use, or the Google Maps JS API — support drawing
polylines/markers on top of the existing map). Start with the manual version; only attempt the automatic path
version if there's time left, since it needs every landmark mention geocoded, not just the final confirmed
address.

**Done looks like:** during a test call flagged as a possible-abduction scenario (per the persona's "MOVING?"
drill-down), the responder can mark or see a simple visual trail on the map reflecting the reported direction of
travel, not just a single static pin.

---

## Live-drawing / generative visual wow ideas

A second pass specifically on real-time visual generation — pushing feature 13 (static incident sketch) further
into something that assembles itself on screen during the actual call, rather than existing as a finished
artifact judges only see afterward.

### 34. Live scene reconstruction that redraws itself as facts update

**Problem:** feature 13 as originally scoped generates a sketch, but doesn't specify *when* — the strongest
version isn't a diagram that exists once consolidation runs, it's one that visibly assembles itself in front of a
judge while the call is still happening: a person icon appears the moment headcount is confirmed, a weapon glyph
fades in the instant that's reported, a vehicle icon rotates to match a reported direction of travel. Watching a
mental model build itself live is a fundamentally different (and stronger) impression than seeing a finished
image afterward.

**What to build:** render feature 13's schematic/iconographic sketch incrementally — each relevant tool call
(`report_situation`, `confirm_address`, a future `report_scene_observation` from Epic 10) triggers one small,
targeted SVG update (add an icon, change an icon's position/rotation, fade one in) rather than regenerating the
whole image from scratch on every change. This is both cheaper (no repeated full-image generation calls) and more
reliable (incremental DOM/SVG updates don't risk Gemini producing a wildly different layout each time) and more
dramatic (it visibly animates in sync with the live call).

**Where it plugs in:** builds on whatever component feature 13 ends up as — the incremental-update requirement
should shape that component's design from the start, so note this before building 13, not as a retrofit. Consumes
the same live `extractedFieldsLive` stream already powering Epic 3.2's field-by-field dashboard reveal.

**Done looks like:** during a live test call, watching the sketch panel while the call plays shows icons appearing
and changing one at a time, timed to match when each fact is actually reported, not all at once at the end.

---

### 35. AI-drawn abduction trail (fuses feature 33 with live drawing)

**Problem:** feature 33's map annotation, as scoped, is manual (a responder clicks/drags to mark a trail). The
more dramatic version has the system draw it: each confirmed landmark becomes a point, and a connecting path
between them is drawn automatically, styled like a hand-drawn investigator's-board arrow, animating across the
map as new landmarks arrive mid-call — directly visualizing the persona's own "gather trace evidence while
they're being moved" behavior.

**What to build:** this requires geocoding every intermediate landmark mention, not just the final confirmed
address (the harder, "automatic path" variant flagged as a stretch under feature 33) — each landmark needs its own
approximate coordinate before a path between them means anything. Once that data exists, drawing an animated
polyline (Leaflet or Google Maps both support this) between successive points, styled distinctly from an ordinary
route line, is comparatively simple.

**Where it plugs in:** depends on feature 33 existing first (same `IncidentMap.tsx` annotation layer), plus
extending `confirmAddress()`/the landmark-gathering tool-call handling in `liveSession.ts` to geocode every
landmark mention as it's reported, not only the final address.

**Done looks like:** during a test call flagged as possible abduction, as the persona gathers successive
landmarks, the map shows a visibly animating trail connecting them in the order they were reported, not just a
single pin.

---

### 36. Live Gemini-narrated "responder co-pilot" text stream

**Problem:** the reasoning-trace panel (feature 10a) shows short, factual "what changed and why" lines. That's
useful but mechanical — it doesn't synthesize connections across everything reported *so far* the way a sharp
human partner listening in would. Real value-add sits one level higher: noticing that two separately-reported
facts actually relate to each other.

**What to build:** a distinct, narrower column reading more like a partner narrating alongside the call — e.g.
"She just confirmed a vehicle — dark colored, moving north. This lines up with her earlier report of being
followed." Rather than firing on every tool call (too noisy, too expensive), run this as a lightweight periodic
Gemini text call — every 20-30 seconds, fed the incident's current extracted fields and recent history — asking it
to synthesize one short observation connecting what's been reported, only if there's something worth saying (skip
silently if nothing new connects).

**Where it plugs in:** a new periodic call similar in shape to `consolidate.ts`/`leakageCheck.ts` but running
during the call rather than at the end — likely triggered from `liveSession.ts` on a timer, writing short
narration lines to a new incident field, rendered in a dashboard panel distinct from the reasoning-trace panel.

**Done looks like:** during a live test call with at least two related facts reported a while apart, the co-pilot
panel produces at least one observation explicitly connecting them, not just restating either fact alone.

---

### 37. Generative "artist's impression" composite revealed at call end

**Problem:** feature 13/34 render live, functional sketches, but nothing produces one clean, presentation-worthy
image summarizing a whole incident — the kind of single visual that could anchor a deck slide or a demo-video
beat.

**What to build:** at call end, generate one schematic composite image — icons for people, weapon, vehicle,
arranged spatially to reflect what was reported — revealed as a single "case card" on the dashboard once
consolidation completes. The safety-critical constraint: this must stay purely iconographic/schematic, exactly
like feature 13's framing, and must never attempt to depict a real person's face or actual likeness — the point is
summarizing known facts visually, not generating a plausible portrait of anyone involved. State this constraint
explicitly wherever this feature is discussed publicly (deck, video), since a careless description of this
feature ("AI draws what happened") could easily be misread as face generation, which is exactly the identity risk
already rejected earlier in this document.

**Where it plugs in:** most likely reuses whatever generation approach feature 13 settles on (structured
layout description rendered as SVG/icons, not a diffusion image model), run once at consolidation time rather than
continuously. New field on the incident record for the finished composite, new card on `IncidentDetailPage.tsx`.

**Done looks like:** a consolidated test case shows one finished schematic composite image summarizing people,
weapon, vehicle and layout — clearly iconographic, never photorealistic or face-like.

---

### 38. Typewriter-style live transcript reveal

**Problem:** feature 15's annotated live transcript, if rendered as plain blocks of text appearing all at once,
loses the "this is happening live" feeling and blunts the timing of its own coded-phrase annotations.

**What to build:** render the live transcript (once captured per feature 15) with a streaming/typewriter reveal
effect — characters or words appearing progressively, mimicking how live transcription actually feels — timed so
a coded phrase's "→ real meaning" annotation pops in right as that phrase finishes appearing, not before or well
after. This is a small, almost entirely frontend animation change layered on top of feature 15's existing
requirement, not a new data source.

**Where it plugs in:** the same transcript display component feature 15 requires — this is a rendering-timing
refinement to it, not a separate component.

**Done looks like:** the live transcript visibly streams in rather than appearing in finished blocks, with each
coded-phrase annotation appearing right as that phrase finishes typing out.

---

### 39. Live "disguise integrity" self-monitoring meter

**Problem:** every other feature in this document assumes the disguise holds. Nothing today checks, in real time,
whether the call still actually sounds like an ordinary order — the leakage check (Epic 2.2) only reviews this
after the call ends. A slipped disguise mid-call (the model breaking character, saying something that would tip
off a listener) is exactly the failure mode the project's own design rules exist to prevent, and there's currently
no live signal if it happens.

**What to build:** a continuously-running, lighter-weight version of the leakage-check logic — instead of one pass
at call-end, periodically (or on each model turn) check the model's own recent responses against the same
"does this sound like it's blowing its own cover" criteria leakage check already applies at the end, surfaced as a
live indicator (e.g. a simple green/amber/red integrity state) on the dashboard during the call. This is a
genuinely different angle from every other item here: the system watching *itself* for a specific failure mode,
not watching the caller or the situation.

**Where it plugs in:** likely a lighter, periodic variant of `web/src/lib/gemini/leakageCheck.ts`'s existing
approach, run during the call from `liveSession.ts` (similar cadence/shape to feature 36's periodic co-pilot
call — worth considering whether these two periodic checks could share one call rather than running as two
separate Gemini calls on separate timers, for cost/latency reasons), writing a live integrity state to the
incident record.

**Recommendation:** scope this carefully before committing — a self-monitoring check needs to be reliable enough
not to cry wolf on ordinary in-character lines (which would be distracting and undermine trust in the indicator),
so treat this as needing real rehearsal-time validation, similar to the caution already flagged for the
second-voice detection bundle below.

**Done looks like:** during a live test call, the integrity indicator stays in a calm state through normal
in-character conversation, and would visibly flag if a deliberately staged in-call break-of-character line were
introduced during rehearsal.

---

### 40. Living "case constellation" — correlated incidents as a pulsing graph

**Problem:** feature 7 (cross-incident correlation) as scoped surfaces a correlation as a static "possibly
related" text link. That undersells what's actually a strong capability — the system noticing that two separate
incidents are connected — by presenting it as a passive label rather than something visually alive.

**What to build:** render correlated incidents as connected nodes in a small graph view (building on feature 19's
multi-incident map/overview), with an animated pulse or glow traveling along the connecting line the instant a new
correlation is detected — a live, growing picture of connections across cases rather than a static list. This is
the most visually ambitious item in this document and depends entirely on features 7 and 19 already existing as a
foundation; not worth attempting before those are solid.

**Where it plugs in:** a new graph-view component, likely a separate mode alongside feature 19's map/overview
rather than replacing it, consuming feature 7's correlation data as it's written.

**Done looks like:** with two or more test incidents seeded to correlate, the graph view shows them as connected
nodes with a visible animated pulse the moment the correlation is detected, not just as static text elsewhere on
the page.

---

## Bigger bets

### 10 + 11. Second-voice detection, in-character extraction, and second-party stress reading

**Problem:** the hotel-call transcript's most dramatic moment is the abductor taking the phone mid-call ("Maddie,
why don't I take this one?"). Our current persona and call flow have zero handling for this — `persona.ts`
assumes the original caller stays on the line throughout, and there's no logic anywhere to detect that a different
person has started speaking.

**What this bundle actually requires** (three linked pieces, likely built together since #11 and #12 depend on
#10 existing):

**10. Second-voice detection** — recognize when a materially different voice starts answering. This is the
hardest part technically: Gemini Live's native audio understanding can plausibly be prompted to flag a tone/voice
shift via a new tool call (e.g. `report_voice_change`), but this needs real testing to see how reliably it
distinguishes "different person speaking" from "same person, different tone under stress" — false positives here
would be actively harmful (Mia reacting as if a second party appeared when it's still the original caller,
stressed). Do not attempt this without dedicated test-call rehearsal specifically targeting this detection, before
building anything on top of it.

**11. Stay-in-character extraction** — once a second voice is detected, `persona.ts` needs explicit instructions
for how Mia behaves: keep playing "restaurant employee" convincingly, and use ordinary-sounding
follow-up questions to extract anything useful (their impatience, their own words) — framed as an opportunity, not
a moment to break cover or ask anything that would reveal Mia isn't really taking a food order. This is a
significant persona-writing effort in its own right — every line said to a suspected threat actor needs the same
same-breath-safety scrutiny (though inverted: safe *for the original caller*, not safe for the second speaker) as
every other coded question.

**12. Second-party stress/aggression reading** — extend the existing `report_stress_level` tool call pattern to
also estimate the second voice's volatility/aggression when one is detected, stored as a distinct field (not
merged into the original caller's `voiceStressScore`/`voiceStressTrend`).

**Where it plugs in:** `persona.ts` (new instructions), `tools.ts` (new tool declarations), `liveSession.ts` (new
tool-call handlers), `shared/incidents/types.ts` (new fields for second-party data), dashboard (surfacing this
distinctly from the primary caller's data).

**Recommendation:** prototype #10 in isolation first — a throwaway test call where a second person deliberately
joins mid-call — before committing to #11/#12. If detection isn't reliable, this entire bundle should be cut
rather than shipped half-working, since a confidently-wrong "second voice detected" signal is worse than no
signal at all.

---

### Responder live-nudge channel

**Problem:** the "Peter, no" transcript shows a human operator actively intervening mid-call — not just watching
and dispatching, but injecting a tactical instruction into the live conversation. Our architecture today is
entirely one-directional: the AI runs the call, the responder only reads what Firestore reports. There is no path
for a human responder to affect an in-progress call at all.

**What to build:** a way for a responder watching the dashboard to send a short instruction (e.g. "ask if he's
still in the room," "tell them police are 2 minutes out") that gets woven into Mia's next turn, without the
responder taking over the call directly. Since the dashboard has no direct socket connection to the caller's
Gemini Live session (that session lives entirely in the QuickBite web app's browser tab), this needs a
Firestore-mediated command queue: the dashboard writes a "nudge" document to a new subcollection (e.g.
`incidents/{id}/nudges`), and `liveSession.ts` needs a listener (or polls) for new nudges and injects them via
`session.sendClientContent()` the same way the existing silence-watchdog injects system notes today (see the
`(System note, not the caller: ...)` pattern already in `liveSession.ts`).

**Where it plugs in:** new Firestore subcollection + rules in `dashboard/firestore.rules`, a new listener in
`liveSession.ts`, a small input UI on the dashboard's incident detail page (`IncidentDetailPage.tsx`) for a
responder to type and send a nudge.

**Honest assessment:** this is the single most novel capability discussed in this whole brainstorm — a genuine
bidirectional responder-to-AI-to-caller loop, not just AI-to-responder reporting. It's also the largest
engineering lift here by a wide margin (new data flow direction, new Firestore listener running inside an
already-complex live session, careful phrasing so an injected nudge never breaks the caller's disguise cover)
and the most likely single item to eat the remaining time budget if attempted. Treat as a stretch goal to attempt
only after everything else in this document (and the existing Phase 1/2 backlog) is solid, not a core commitment.

---

## UI / GenAI "wow factor" ideas (judge-facing polish)

These are aimed specifically at what makes a judge's reaction visible in the room, not at closing a functional
gap — see `docs/prototype_build_plan.md`/backlog notes on the 10% UX scoring line and the 40% technical-merit
line ("a chatbot wrapper loses on technical merit even with a good cause" — these ideas are about proving this
isn't one, visually, not just architecturally).

### 13. Live auto-generated incident sketch

**Problem:** the dashboard shows extracted fields as text/chips. A judge doesn't get any sense of the AI actually
"understanding" a scene, just that it's filling out a form.

**What to build:** as fields populate during a call (people count, weapon presence, vehicle, spatial hints like
"near the door"), generate a simple schematic/icon-based scene diagram — not a photorealistic image, a
top-down or simple iconographic layout (e.g. person icons, a door, a vehicle icon) reflecting what's currently
known. This could use Gemini to output structured positions/icons (a JSON layout description) rendered with plain
SVG/CSS on the dashboard, rather than an actual image-generation model — cheaper, faster, more reliable to keep
in sync with live field updates, and avoids ever implying the system knows exact real appearances (which would be
both inaccurate and a disguise/trust risk if ever exaggerated in the pitch).

**Where it plugs in:** a new dashboard component consuming the same `extractedFieldsLive` data already live-
updating via Epic 3.2, translating specific fields into a layout description, rendered as SVG. No changes needed
to the QuickBite app side.

**Risk to flag:** reliability of consistently useful layouts from sparse/varying field data — worth a quick
spike (a handful of test field-sets fed through a prompt) before committing, since a sketch that looks
nonsensical or misleading would hurt more than an absent feature.

**Done looks like:** during a live demo call, the dashboard shows a simple, clearly-schematic diagram that
visibly updates as new details are reported (e.g. a vehicle icon appears once one is mentioned).

---

### 14. Live sentiment/waveform visualization synced to voice stress

**Problem:** `voiceStressScore` is currently shown as a plain number (see the "VOICE STRESS" card in
`IncidentDetailPage.tsx`, currently a static value + sparkline). A number doesn't give a judge an immediate felt
sense of tension rising during a live demo call the way an animated visual would.

**What to build:** an animated waveform, pulse, or color-shifting visual synced to the existing
`report_stress_level` updates (already fired every ~15-20s per `persona.ts`) — amplitude/color intensifying as the
score rises. This is pure frontend visualization work: no new AI calls, no new tool declarations, just a richer
rendering of data already flowing into `voiceStressTrend`.

**Where it plugs in:** replaces or augments the existing `StressMeter`/`StressSparkline` components in
`dashboard/src/components/`. Could also tap the raw mic audio stream directly for a true live waveform (separate
from the periodic score) if a more continuous visual is wanted, using the Web Audio API's analyser node on
`player.recordingStream`/mic stream already available in `audio.ts` — likely more visually convincing than
animating between periodic score updates alone, at some added complexity.

**Done looks like:** during a live test call, the stress visualization on the dashboard visibly changes in real
time, not just updating a number every 15-20 seconds.

---

### 15. Real-time transcript with color-coded decoded-meaning annotations

**Problem:** the entire premise of Covert Call — a coded phrase secretly meaning something else — is invisible to
a judge watching the dashboard unless it's explained verbally. This is the single most direct way to make the
mechanism self-explanatory on screen.

**What to build:** display the live transcript (now captured via `inputTranscription`/`outputTranscription` per
the recent transcription fix in `liveSession.ts`) on the dashboard's incident detail page, with coded phrases
automatically detected and annotated inline — e.g. "extra pepperoni" shown struck through or highlighted, with
"→ weapon present" appearing beside it as it's said. Since the code table (phrase → meaning) already exists
conceptually in `persona.ts`'s Step 4/Step 5 sections, the cleanest implementation is to extract that mapping into
a shared, structured data file (this dovetails directly with backlog Epic 8.1's planned "move scenario codes into
one shared code table" work) and match transcript text against it client-side, rather than relying on a second
Gemini call to interpret the transcript.

**Where it plugs in:** requires the shared code table refactor (Epic 8.1) to exist first, ideally — or a simpler
standalone keyword list if that refactor hasn't landed yet. New transcript display component on
`dashboard/src/pages/incident/IncidentDetailPage.tsx`, fed by the transcript lines already being captured (would
need those written to Firestore live, not just held in `liveSession.ts`'s local `transcriptLines` array which
today is only used at call-end for consolidation — this is a real gap to close: transcript lines aren't currently
streamed to Firestore at all during the call).

**Done looks like:** during a live demo call, a judge watching the dashboard sees the transcript scroll with
coded phrases visibly highlighted and their real meaning shown alongside, in real time, without narration.

---

### 16. "What the AI is thinking" live status line (demo overlay)

**Problem:** during a live demo, judges watching the phone screen see... a normal call screen. There's no way to
narrate what Mia is currently doing internally without talking over the actual call audio.

**What to build:** a small, demo-only status line — "Listening for danger signals... / Confirming address... /
Assessing urgency..." — that updates based on which step of the persona's call flow (`persona.ts`'s Step 3
through Step 9) is currently active. This must **never** appear on a real caller-facing build (it would
immediately break the disguise if visible to anyone glancing at the caller's phone) — scope this explicitly as a
demo-mode-only overlay, likely gated behind an environment flag or a separate demo build, shown on a *second*
screen mirroring the call (e.g. for a judge or camera), never on the actual phone screen a caller would be
holding.

**Where it plugs in:** requires `liveSession.ts` to expose which step/phase is currently active — likely inferred
from which tool calls have fired so far (e.g. `confirm_address` called → now past the address step) rather than
anything the model explicitly reports, to avoid adding new tool-calling overhead purely for a demo feature. Needs
careful placement to guarantee it can't leak into the real caller-facing UI.

**Done looks like:** a separate demo-mode view (not the real `CallPage.tsx`) shows a live-updating status line
during a test call, useful specifically for judge-facing screen-recording or live demo narration.

---

### 19. Heatmap/cluster view for multiple incidents

**Problem:** a single-incident demo can look like "one clever trick," not infrastructure. If the demo can show
multiple incidents live or seeded, the dashboard's map today (per Epic 4.3) shows individual pins, not a system-
level view.

**What to build:** a map view mode showing severity-colored clustering across multiple incidents at once (not
per-incident detail, a system overview), reusing the same map integration already built for Epic 4.3
(`IncidentMap` component, Google Maps or free OpenStreetMap). Ties naturally into feature 7 (cross-incident
correlation) — could visually link correlated incidents on this same view.

**Where it plugs in:** likely a new mode on the existing live-queue view (Epic 4.2) or a dedicated map page,
reusing `dashboard/src/components/IncidentMap.tsx` with multiple incidents passed in instead of one.

**Done looks like:** with 2-3 test/seeded incidents active, a map view shows them clustered and colored by
severity, giving a visual "this is a monitoring system" impression rather than "this is one call."

---

## Summary table

| # | Feature | Effort | Where |
|---|---|---|---|
| 1 | Presence-filling chatter during pauses | Quick win | persona.ts |
| 2 | Guess-and-confirm fallback mode | Quick win | persona.ts |
| 3 | Dropped-call handling | Quick win | liveSession.ts, client.ts, severity.ts, types.ts, dashboard |
| 4 | Bystander-witnessing-live-event scenario code | Quick win | persona.ts |
| 5 | Situationally-anchored safety advice | Quick win | persona.ts (scope note for future Epic 10.4 work) |
| 6 | Re-alert on material change | Medium | dashboard alert logic (Epic 4.6 area) |
| 7 | Cross-incident correlation | Medium | new correlate.ts, client.ts, dashboard |
| 8 | Nearby police/fire/rescue stations | Medium | geocode.ts area, dashboard |
| 9 | Google Search grounding (non-personal facts) | Medium | new helper, consolidation area |
| 10a | Live AI reasoning trace panel | Medium | client.ts, types.ts, dashboard |
| 10b | Animated confidence dial | Medium | client.ts, IncidentDetailPage.tsx |
| 12 | Decision-support recommendation line | Medium | severity.ts, dashboard |
| 20 | Escalation audio cue for already-open incidents | Medium | IncidentDetailPage.tsx |
| 21 | "Golden thread" replay scrubber | Medium-Big | liveSession.ts (timestamped transcript), IncidentDetailPage.tsx |
| 22 | Dispatch-bulletin-formatted briefing card | Medium | consolidate.ts, types.ts, dashboard |
| 23 | "What changed since you last looked" diff banner | Medium | viewedAt tracking, IncidentDetailPage.tsx |
| 26 | Callback-attempt status (single try, no real telephony) | Quick win | IncidentDetailPage.tsx (dropped-call banner) |
| 28 | "Next most urgent" hotkey | Quick win | App.tsx, ranking.ts |
| 32 | One-click shareable bulletin for external handoff | Quick win (after 22) | IncidentDetailPage.tsx |
| 33 | Inline map direction/perimeter annotation | Medium-Big | IncidentMap.tsx |
| 34 | Live-redrawing scene reconstruction | Medium | extends feature 13's component |
| 35 | AI-drawn abduction trail (auto-geocoded) | Big (needs 33 first) | IncidentMap.tsx, liveSession.ts |
| 36 | Live Gemini co-pilot narration stream | Medium | new periodic call from liveSession.ts, dashboard |
| 37 | Generative composite reveal at call end | Medium | extends feature 13's approach, dashboard |
| 38 | Typewriter-style transcript reveal | Quick win (needs 15 first) | extends feature 15's component |
| 39 | Live disguise-integrity self-monitoring meter | Big (needs rehearsal validation) | new periodic call, liveSession.ts, dashboard |
| 40 | Living "case constellation" correlation graph | Big (needs 7 + 19 first) | new graph component, dashboard |
| 10-11 | Second-voice detection + in-character extraction + stress read | Big bet | persona.ts, tools.ts, liveSession.ts, types.ts, dashboard |
| — | Responder live-nudge channel | Big bet | new Firestore subcollection, liveSession.ts, dashboard |
| 13 | Live auto-generated incident sketch | Wow factor | new dashboard component |
| 14 | Live stress waveform visualization | Wow factor | audio.ts, dashboard StressMeter |
| 15 | Annotated live transcript (coded → real meaning) | Wow factor | Epic 8.1 code table, liveSession.ts, dashboard |
| 16 | "What the AI is thinking" demo overlay | Wow factor | liveSession.ts, new demo-only view |
| 19 | Multi-incident heatmap/cluster view | Wow factor | IncidentMap.tsx, dashboard |

**Rejected**: deep search / identify-a-person from public data — not included above, see note at top of document.
