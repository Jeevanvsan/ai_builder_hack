# QuickBite / Covert Call — End-to-End Test Cases

Covers both sides of the system: the QuickBite disguised web app (caller/user side) and the
responder dashboard. Written directly from the current code (Sept 2026) — every feature listed
here actually exists; nothing is aspirational. Use this as a manual test script before any demo
or judged run.

**How to use this doc**: work top to bottom. Each test case has Preconditions, Steps, Expected
Result. "Pass/Fail" is left blank for you to fill in during a run. Where a case depends on another
(e.g. dashboard cases need an incident created by a web-side case first), that's noted.

**Environments needed**: the deployed web app (`https://quickbite-5cde0.web.app`), the deployed
dashboard (`https://quickbite-5cde0-dashboard.web.app`), two browser windows/devices open side by
side (one acting as caller, one as responder), and ideally one real phone for the camera/mic/GPS
cases (desktop browsers can't fully exercise those).

---

## Part A — QuickBite web app (caller side)

### A1. Disguise / home screen

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A1.1 | Home screen loads as an ordinary food app | Open the web app URL | Menu items, categories, search bar, promo banner, top bar with brand/address/heart/account icons — nothing suggesting a safety feature |
| A1.2 | Search filters menu | Type a partial dish name in the search bar | Only matching items show; category sections with zero matches disappear |
| A1.3 | Category filter | Tap a category chip | Only that category's items show |
| A1.4 | Promo banner hides during search | Type in search bar or select a category | Promo banner disappears; clear search/filter → banner reappears |
| A1.5 | Item sheet opens | Tap any menu item | A detail sheet opens for that item; footnote disclaimer text is visible |
| A1.6 | No visible safety UI anywhere | Browse the whole home screen without triggering any gesture | No button, icon, or text hints at "SOS," "emergency," "call for help," etc. |

### A2. Hidden SOS trigger (heart double-tap)

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A2.1 | Single tap does nothing | Tap the heart icon once, wait | No navigation, no visible state change (looks like an inert favourites button) |
| A2.2 | Slow double tap does nothing | Tap heart, wait >400ms, tap again | No navigation — trigger requires both taps within 400ms |
| A2.3 | Fast double tap triggers SOS | Tap the heart icon twice within ~400ms | App immediately navigates to `/sos` — full black screen, no transition text |
| A2.4 | No visual feedback pre-trigger | Perform A2.3 again, watch closely | No flash, highlight, or animation on the heart icon itself before the screen goes black — the gesture must look accidental-proof, not "revealed" |

### A3. Silent SOS — media acquisition and blackout screen

**Precondition**: perform on a real phone with both front and back camera + mic, browser permissions not yet granted.

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A3.1 | SOS starts a high-severity incident immediately | Trigger SOS (A2.3) | A new incident appears on the dashboard queue within a few seconds, severity **high**, channel **Silent SOS**, scenario "hostage" — before anything has been said or seen |
| A3.2 | Screen is genuinely black | After trigger | Full black screen, no UI elements, no cursor/controls visible |
| A3.3 | Long-press / context menu suppressed | Long-press anywhere on the black screen | No browser context menu (copy/inspect/etc.) appears |
| A3.4 | Dual camera acquired on a phone with 2 working cameras | Trigger SOS on a real phone | Dashboard shows `cameraMode: dual`; both back and front live video tiles appear in the incident's side panel |
| A3.5 | Single-camera fallback | Trigger SOS on a laptop/device with only one camera | Dashboard shows `cameraMode: back-only` (or equivalent); no duplicated/doubled camera feed; only one live feed shown |
| A3.6 | Frozen/dead camera is dropped, not published | (Hard to force manually — use as a regression check) If a camera opens but produces no changing frames within ~700ms | That camera is silently excluded from published feeds (check browser console for `"...opened but produced no frames — dropping it"` warning); the other camera still works |
| A3.7 | Silent room does not disable the mic | Trigger SOS in a completely silent room | Mic stream is still kept and sent to the AI observer (console shows a warning like `"mic opened but measured no audio level..."` but does NOT stop capture) — verify by later checking the incident still has a working audio-based record, not a missing mic |
| A3.8 | Wake lock keeps screen alive | Trigger SOS and leave the phone untouched for 2+ minutes | Screen does not auto-lock/dim on a device that supports Wake Lock (best-effort — note if OS still sleeps it) |

### A4. Silent SOS — silent observer detection

**Precondition**: A3 media acquisition working; dashboard open on the same incident.

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A4.1 | Observer detects spoken conversation | After triggering SOS, speak normally near the phone as if in a real threatening scenario (e.g. "please don't hurt me", mention a weapon) | Dashboard's incident shows updated `dangerIndicators`, `peopleCount`, `urgency`, and/or scene observations within a few seconds — confirms the AI is actually listening |
| A4.2 | Observer never speaks back | During A4.1 | No audio is ever played out of the phone's speaker — the observer is one-way only |
| A4.3 | Scene observation via camera | Hold the phone so the camera sees something notable (a weapon-like object, another person, etc.) | Dashboard's "Seen/heard" evidence tile shows a camera-sourced observation |
| A4.4 | Caller age/gender estimate reported once | Speak for at least 15-20 seconds during the SOS | Dashboard's Case file → Fact sheet shows a "Caller (AI estimate)" line with age group / gender, labeled "unconfirmed, from voice" |
| A4.5 | Voice stress reported periodically | Speak continuously for 30+ seconds, varying tone (calm vs distressed) | Dashboard's stress meter/tile updates more than once over the session, reflecting a trend, not a single static value |

### A5. Silent SOS — exit gesture and teardown

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A5.1 | 1-2 taps don't exit | While in SOS blackout, tap the screen once, then again after >1.5s | SOS stays active, does not exit |
| A5.2 | 3 taps within 1.5s exits | Tap the black screen exactly 3 times, all within 1.5 seconds, at any location on screen (not just a corner) | App exits SOS and navigates back to `/` (home) within a few seconds |
| A5.3 | Exit works even mid-recording/mid-network-issue | Trigger SOS, wait ~10s (recorder/observer running), then perform the 3-tap exit | Exit completes and navigates home within ~10 seconds max (teardown has internal timeouts) — must NOT hang indefinitely on a black screen |
| A5.4 | Zero-trace exit | After A5.2/A5.3 | No visible trace of the SOS screen or session remains in the app's visible state (back at ordinary home screen, no browser back-button artifact revealing `/sos` in a suspicious way) |
| A5.5 | Recording upload continues in background after exit | After exiting SOS, wait 1-2 minutes, then check the dashboard's incident recordings section | Video/audio recordings eventually show as "Uploaded" (Drive-configured) even though the exit itself was immediate |
| A5.6 | Case summary generated after SOS ends | After exit, wait up to 90 seconds, check the dashboard's Case file tab | A consolidated case summary / bulletin appears (best-effort; if it fails, dashboard should show an explicit "summary failed" message, not blank silence) |

### A6. Regular voice call — start, persona, and covert mode

**Precondition**: cart must be empty (a non-empty cart redirects away from `/call`).

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A6.1 | Call blocked with items in cart | Add an item to cart, then navigate directly to `/call` | Redirected to `/cart`, call does not start |
| A6.2 | Call connects | With empty cart, navigate to `/call` | Status shows `connecting` then `live`; timer starts counting up (MM:SS) |
| A6.3 | Incident created on call start | Immediately after A6.2 | New incident appears on dashboard, channel **live-call**, `callState: active` |
| A6.4 | Covert mode greeting | Let the call connect and listen to the opening | AI (Mia) opens in English, in a food-order/covert framing — not "how can I help you in an emergency" |
| A6.5 | Coded question includes real meaning in same breath | Continue the conversation naturally | Every coded question Mia asks states its real meaning in the same sentence (e.g., "Would you like extra spicy — meaning, has anyone hurt you?") — never a bare coded phrase alone |
| A6.6 | Options-only in covert mode | Observe Mia's questions while in covert mode | Only 2-3 food-word choices offered, or plain name/address/landmark/pin-code questions — never an open-ended direct safety question while covert |
| A6.7 | Switch to open mode | Say "I can talk" or "I want to place an order" (per the persona's own trigger words), or state your situation plainly | Mia switches to open/direct questions for the rest of the call |
| A6.8 | Language switch persists | Mid-call, respond in a different language than English | Mia switches to that language and stays in it for the rest of the call; tool call reports (not visible to you, but check dashboard transcript annotations) remain in English |
| A6.9 | Mute button works | Tap mute while live | Mic stops sending; unmute resumes sending (mute button disabled while not live) |
| A6.10 | Call end via button | Tap the end-call button | Status becomes `ended`; app proceeds to teardown/upload/exit flow |

### A7. Regular voice call — danger indicators and drill-down

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A7.1 | Weapon mention escalates urgency | State a weapon is present | Dashboard's danger indicators update with a weapon-related tag; incident severity becomes **high** |
| A7.2 | Drill-down follows category | Report harm to someone else vs to yourself | Mia asks the correct branch of follow-up questions per persona rules (headcount/presence/weapon type/injury/etc.) rather than a generic script |
| A7.3 | Location sequencing | Provide an area/town when asked | Dashboard's location eventually shows a confirmed address; `get_route_guidance`-driven behavior triggers if situation calls for it |
| A7.4 | Moving/chased override skips address spelling | State you are being chased and are in a vehicle | Mia does NOT ask for detailed address/spelling; instead relies on live GPS and gives route guidance |
| A7.5 | Mandatory scene/sound monitoring — glass breaking | Make a breaking-glass sound or state "I just heard glass break" | Mia immediately (same turn) treats this as high urgency and gives safety advice appropriate to a break-in (e.g., "keep quiet, find cover") — NOT generic/unrelated advice |
| A7.6 | Gunshot / scream detection | State or simulate a gunshot/scream event verbally | Same-turn high-urgency escalation, scene observation logged, no waiting for caller confirmation |
| A7.7 | Read-back before goodbye | Reach the end of the coded conversation flow | Mia reads back a summary before saying goodbye and ending the call |
| A7.8 | Never ends on an unanswered greeting | Say nothing after Mia's opening greeting | Mia does not immediately end the call — she waits/retries per the silence-handling rule before any decision to end |

### A8. Regular voice call — silence handling and call drop

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A8.1 | Silence retried gently, then ends if nothing dangerous reported | Go completely silent for the whole call, never speak | After 3 unanswered gentle prompts, Mia logs "no response — possibly unable to speak," sets urgency high, says goodbye, and ends the call — this should NOT happen faster (e.g., after 1 prompt) or hang indefinitely |
| A8.2 | Silence after danger is reported never ends the call | Report a dangerous situation, then go silent | Mia goes completely silent (no more check-in prompts) and the call is **not** ended by her — it should stay connected until you speak again or a responder ends it from the dashboard |
| A8.3 | Connection drop mid-call is distinguished from a real hangup | Force a network interruption mid-call (e.g. disable Wi-Fi briefly) long enough to exhaust reconnect attempts | Dashboard shows `dangerIndicators` including something like "call disconnected unexpectedly," urgency **high** — this must look different from a normal "caller said goodbye" ended call |
| A8.4 | Reconnect works on a brief drop | Force a short network blip (a few seconds) mid-call, then restore | Call reconnects and continues without creating a new incident or losing prior conversation context |

### A9. Regular voice call — teardown and uploads

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A9.1 | End call never hangs | End the call under normal conditions | App returns to home/menu within a few seconds |
| A9.2 | End call doesn't hang even with a slow network | Throttle network (dev tools) right before ending the call | App still exits within ~8-10 seconds max (consolidation is timeout-capped) |
| A9.3 | Audio recording uploads | End a call that had audio, wait, check dashboard | Call audio recording appears in the incident's Case file, playable or downloadable |
| A9.4 | Video recording uploads (if camera was on) | End a call that had back-camera video, wait, check dashboard | Back-camera video appears, playable/downloadable |
| A9.5 | Upload failure is surfaced, not hidden | (Simulate by breaking Drive config temporarily, or check historical failed case) | Dashboard shows an explicit "failed" state with a reason, not silent blank space |

### A10. Delivery Instructions (silent tap) flow

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A10.1 | Reach the page | Navigate to `/delivery-instructions` (find the real in-app path to it, likely from checkout/cart) | Page loads with 5 tappable "delivery instruction" options, an address field, photo attach, and a note field |
| A10.2 | Press-and-hold reveals real meaning | Press and hold one option for ≥500ms | The real (safety) meaning appears inline while held |
| A10.3 | Releasing early hides the meaning | Press and release before 500ms | Nothing is revealed |
| A10.4 | Multi-select combines urgency correctly | Select "Call on arrival" (medium) then also select "Don't ring, leave silently" (high) | Combined urgency becomes **high** (the higher of the two), and both indicators are recorded |
| A10.5 | Photo attach triggers AI analysis | Attach a photo | State moves idle → analysing → attached; dashboard shows resulting danger indicators/notes and a camera-sourced scene observation; raw photo itself is never stored, only the AI's text summary |
| A10.6 | Photo failure retry | Attach a corrupt/invalid file if possible, or simulate failure | State becomes "failed", UI invites retry (tap to retry) |
| A10.7 | Submit disabled until incident ready | Try tapping "Save instructions" immediately on page load | Button is disabled until the incident is created in the backend |
| A10.8 | Submit exits cleanly | Fill in note/address, tap "Save instructions" | Zero-trace exit occurs, same as other flows |

### A11. Click & Order coded flow

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| A11.1 | Coded item decodes correctly | Add a coded menu item (e.g. one mapped to "weapon present") to cart and place the order | Dashboard incident (channel **click-order**) shows the correct decoded danger indicator and high urgency matching that code |
| A11.2 | Delivery speed affects urgency | Choose "ASAP" delivery speed with an otherwise low-urgency coded item | Combined urgency reflects the higher of the item code and delivery-speed urgency |
| A11.3 | Disguise never breaks on failure | Simulate a backend failure during order placement (e.g. throttle network to fail the incident write) | Order-placed confirmation screen still appears normally regardless of whether the real incident was created |
| A11.4 | Order-placed screen mirrors status believably | After placing a coded order, watch the Order Placed screen while a responder changes status on the dashboard | Screen updates through believable delivery milestones ("Rider assigned" → "On the way" → "Delivered") — never shows real safety-response language |
| A11.5 | Multiple coded items combine | Add two different coded items with different danger indicators to one order | Dashboard shows both indicators, deduplicated if identical, combined peoplecount as the max quantity among them |

---

## Part B — Responder dashboard

**Precondition for all of Part B**: at least one active/open incident exists (from any Part A flow above), and you are logged in as a responder.

### B1. Queue page

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B1.1 | New incident appears immediately | Trigger any Part A flow | New incident card appears in the queue within a few seconds, no manual refresh needed |
| B1.2 | Stat tiles are accurate | Create incidents of varying severity/status | "Open incidents," "High severity," "Unclaimed," "Live calls" counts match what's actually on screen |
| B1.3 | Ranking prioritizes correctly | Create 2+ open incidents with different severities/ages | Unviewed-first, then high severity, then longest-waiting — verify the higher-priority incident is listed first |
| B1.4 | Card shows key info at a glance | Inspect any card | Severity chip, channel label, SOS badge (if SOS), live/ended state, danger indicators (max 2 + "N more"), people count, stress meter, location, elapsed timer all visible without opening the case |
| B1.5 | Clicking/Enter opens the case | Click a card, or Tab-focus + Enter | Navigates to that incident's detail page |
| B1.6 | Pagination works | With enough incidents to overflow one page | Pagination controls appear and work correctly |

### B2. Critical alerts popup

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B2.1 | Popup fires on life-threatening escalation | From an active call/SOS, trigger a critical escalation phrase (e.g. shots fired, break-in) | A modal popup appears on the dashboard even if the responder is on a different page — breaks through do-not-disturb |
| B2.2 | Popup content is accurate | Inspect the popup | Shows the escalation reason, location, AI recommendation, nearest relevant station, live/ended status |
| B2.3 | Dismiss removes only this alert | With 2+ queued critical alerts, dismiss the first | Alert closes; if another is queued, it should be indicated ("N more waiting") — verify behavior matches |
| B2.4 | Call station button works | If a route destination has a phone number | "Call {station}" button opens a `tel:` link |
| B2.5 | Open case navigates correctly | Click "Open case" (or "Open & listen live") | Navigates to the incident detail page |
| B2.6 | Acknowledge & dispatch from popup | On a `new` status incident's alert, click "Acknowledge & dispatch" | Incident status becomes acknowledged and the case opens; no visible error |
| B2.7 | Race condition — already claimed | Have two responder sessions try to acknowledge the same incident from the popup simultaneously | The second attempt fails silently (no jarring error) since someone else already claimed it |

### B3. Case board — visual and evidence tiles

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B3.1 | Case hub shows core state | Open any active incident | Severity, live/ended, timer are visible in the central hub |
| B3.2 | Only tiles with real data render | Open an incident with minimal data (e.g., just started) | Only tiles with actual content show; empty-data tiles are not rendered as blank placeholders |
| B3.3 | Critical banner appears correctly | Trigger a critical-now event (shots fired, glass, grabbed, etc.) during a **live** call | Red/critical banner appears on the board showing the matched danger text and AI recommendation |
| B3.4 | Critical banner does not appear after call ends | End the call after B3.3 | Banner should no longer show as "live critical" (verify actual current behavior matches this expectation) |
| B3.5 | Nearby help tile loads stations | Open an incident with a confirmed location | "Nearby help" shows up to 3 nearest police/fire/hospital with distance and phone number; shows a loading shimmer briefly first |
| B3.6 | No stations within range | Test with a location that has genuinely no stations within 5km (rural test coordinate if possible) | Tile shows "no stations within 5km" rather than an empty/broken tile |
| B3.7 | "Route here" sets a route | Click "Route here" on any listed station | Route-to-safety tile appears/updates with that station as destination, labeled "set by dispatcher" |
| B3.8 | AI-chosen route is labeled differently | Trigger `get_route_guidance` from the web-app side (A7.3/A7.4) | Route-to-safety tile shows "chosen by AI" instead of "set by dispatcher" |
| B3.9 | Vehicle/subjects/threat tiles bucket correctly | Report indicators describing a vehicle, a person's appearance, and a generic threat separately | Each appears in its correct tile (vehicle info in vehicle tile, not threat tile, etc.) |
| B3.10 | Weapon mention pinned to top of threat tile | Report several indicators, with a weapon mention early, followed by several newer non-weapon indicators | The weapon mention remains visible at the top of the threat tile even though it's not the most recent |
| B3.11 | Linked cases (AI correlation) | Wait after a call ends (up to 60s) with distinguishing details (same vehicle/person as another test incident, if reproducible) | "Linked" tile shows AI-correlated case IDs if a match is found, or the shimmer disappears cleanly if nothing found |
| B3.12 | Nearby/recent incident linking (rule-based) | Create two incidents at very close locations within 7 days | Both show a "same place, last 7 days" linked reference to each other |
| B3.13 | Location tile shows moving state | During a live call with GPS tracking active, watch the location tile | Shows "Moving — live position updated Ns ago" while GPS updates are recent |
| B3.14 | Location tile shows approximate state | Use a scenario where geocoding fails or is low-confidence | Location tile clearly marks it as "Approximate" rather than presenting it as exact |
| B3.15 | Grounded context pending shimmer | Right after a call ends, check the location tile before grounded context arrives | Shows "Checking local conditions…" shimmer for up to 60 seconds, then either shows the result or stops shimmering |

### B4. Severity and negation logic

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B4.1 | Weapon mention raises severity to high | Report any weapon-related indicator | Incident severity becomes **high** |
| B4.2 | Negated weapon mention does NOT raise severity | Cause an indicator phrased as a negation (e.g. "no weapon involved," "unarmed") to be recorded (may require an actual conversation where caller says "there's no weapon") | Severity/recommendation must NOT escalate based on this indicator — it should be treated as if it weren't a threat |
| B4.3 | High voice stress alone raises severity | Achieve a voice stress score ≥80 without any dangerous indicators | Severity becomes **high** based on stress alone |
| B4.4 | Recommendation escalates for armed + contact | Report shots fired AND the attacker reaching the caller (e.g. "grabbed," "broke in") | Recommendation text specifically calls for immediate armed police + ambulance dispatch, more specific than the generic high-severity text |
| B4.5 | Severity escalation logged in reasoning trace | Watch severity change from low/medium to high during a live call | A reasoning trace entry appears explaining why (urgency reported, last indicator, stress if relevant) |
| B4.6 | Escalation cue plays only on upward change | Watch/listen while severity goes low → high, then later something causes it to compute as lower again | Audible/visual escalation cue fires only on the upward transition, not on the downward one, and not on initial page load |

### B5. Side panel — conversation and case file

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B5.1 | Conversation tab shown while live | Open a live call's incident | Side panel defaults to "Conversation" tab |
| B5.2 | Case file tab shown once ended | End the call, revisit the incident | Side panel defaults to "Case file" tab |
| B5.3 | Manual tab selection respected per phase | While live, manually switch to "Case file" tab, then let the call continue | Tab stays on "Case file" until the live/ended phase changes again |
| B5.4 | Coded phrases highlighted in transcript | During a click-order/silent-tap-adjacent or coded voice conversation, check the Conversation tab | Coded food phrases are shown with strikethrough plus the real meaning inline |
| B5.5 | Transcript live-updates smoothly | Watch the transcript during an active call | New lines appear with a typewriter effect on just the newest line; no duplicate/garbled lines from streaming growth |
| B5.6 | Case summary appears after call ends | End a call, wait up to 90 seconds | Consolidated summary appears in Case file tab |
| B5.7 | Summary failure shown explicitly | Simulate/observe a failed consolidation (e.g. from earlier network throttling test) | An explicit failure message is shown, with fact sheet fallback — not a blank tab |
| B5.8 | Fact sheet fallback before summary ready | Check Case file tab within the first ~90 seconds after call end, before summary arrives | Fact sheet (urgency, people, danger, location, movement, route, stress, caller estimate) is shown as an interim view |
| B5.9 | Bulletin card "copy for radio" | Once a bulletin exists, click "Copy for radio/handoff" | Clipboard receives the plaintext bulletin; button shows "Copied" confirmation for ~2 seconds |
| B5.10 | Leakage/redaction check shown | After consolidation completes | A "Third-party check" line shows the leakage check status |

### B6. Side panel — recordings

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B6.1 | Drive-hosted audio downloadable | After a call with Drive configured completes and uploads | "Download" link works and produces a real audio file |
| B6.2 | Drive-hosted video downloadable, per camera | After an SOS/call with video completes | Each camera's video is separately downloadable/labeled ("Front camera"/"Back camera") |
| B6.3 | Uploading state shown while in progress | Check recordings section immediately after call end, before upload finishes | Shows "Uploading…" rather than a broken/missing state |
| B6.4 | Drive failure falls back to Firestore-stored audio | Simulate Drive upload failure (bad URL) with an active call | "Drive upload failed — backup copy below" message + Firestore-based audio player appears and is playable |
| B6.5 | Total failure shown with reason | Simulate both Drive and Firestore fallback failing | `recordingFailed` message with the actual reason text is shown |
| B6.6 | Video failure shows failReason | Simulate a video upload failure | Video row shows "Failed" with the specific reason string, not generic text |

### B7. Replay scrubber

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B7.1 | Scrubber appears only after call ends | Check a live call's Case file tab, then after it ends | Scrubber is absent while live, present once ended (assuming transcript/field history exists) |
| B7.2 | Scrubbing shows correct point-in-time state | Drag the scrubber to an early point in the call | Shows transcript lines up to that point and the field-history snapshot most recent at-or-before that point, not future data |
| B7.3 | Empty states before any data | Scrub to time 0 before anything was said/extracted | "Nothing said yet" / "Nothing extracted yet at this point" shown appropriately |
| B7.4 | Scrubber hidden when no data exists at all | Check a very short/empty test call | Scrubber does not render at all if there's no transcript and no field history |

### B8. Response actions and status workflow

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B8.1 | New → Acknowledge | Open a `new` incident, click "Acknowledge" | Status becomes `acknowledged`, acknowledgedBy/At recorded |
| B8.2 | Acknowledge → Start response | Click "Start response" on an acknowledged incident | Status becomes `in_progress` |
| B8.3 | Resolve requires confirmation | Click "Resolve" | A confirmation modal appears before resolving |
| B8.4 | Resolving a live call warns about ending it | Resolve while the call is still live | Modal explicitly warns that resolving will also mark the call as ended |
| B8.5 | Resolved shows no further actions | After resolving | Only "Resolved" text shown, no action buttons |
| B8.6 | Already-claimed error surfaced | Two responder sessions try to acknowledge the same `new` incident nearly simultaneously | The losing session shows a clear "already claimed" message, not a generic crash |
| B8.7 | Viewed tracking clears "new" highlight | Open a never-before-opened incident | `viewedAt` gets set; the "new"/unviewed highlight disappears for all responders viewing it afterward |
| B8.8 | Changes-since-last-view banner | View an incident, leave, let something change (new indicator/escalation), revisit | A "Since you last checked: ..." banner summarizes what changed |

### B9. History page (resolved cases)

**Precondition**: at least one resolved incident exists.

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B9.1 | Resolved case appears | Resolve an incident (B8.5) | It shows up in History, disappears from the open Queue |
| B9.2 | Search matches incident ID | Search by a resolved incident's ID | That row is returned |
| B9.3 | Search matches channel — "sos" | Search "sos" | Any resolved Silent SOS case matches (this was a previously fixed bug — regression-test it explicitly) |
| B9.4 | Search matches address/summary/handler | Search a substring of a known confirmed address, or a responder's name, or a word from the case summary | Matching case(s) returned |
| B9.5 | Severity filter | Filter by "High" | Only high-severity resolved cases shown |
| B9.6 | Channel filter | Filter by "Silent SOS" | Only SOS-channel cases shown |
| B9.7 | Handled-by filter | Filter by a specific responder | Only cases they resolved shown |
| B9.8 | Period filter — Last 24 hours | Filter to "Last 24 hours" | Only cases resolved within 24h shown; older cases excluded |
| B9.9 | "Any time" bypasses resolvedAt requirement | Filter to "Any time" | Cases even without a clean `resolvedAt` timestamp are not incorrectly excluded |
| B9.10 | Filters persist in URL | Apply several filters, copy the URL, open in a new tab | Same filtered view loads from the URL alone |
| B9.11 | Clear filters resets everything | With filters active, click "Clear filters" | All filters reset, full result count shown |
| B9.12 | Result count reflects filtering | Apply any filter | "X of Y resolved cases" text matches the actual visible row count |
| B9.13 | Row click opens incident detail | Click any row | Navigates to that incident's detail page |
| B9.14 | Time-to-resolve column is accurate | Inspect a known test case with a known duration | Matches actual elapsed time from start to resolution |

### B10. Timeline rail

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B10.1 | Timeline spans full session | Open any incident's detail page | Rail spans from session start to now (live) or end (resolved) |
| B10.2 | Escalation color transitions | Cause severity to escalate mid-call | Rail shows a hard color-stop transition at the escalation point |
| B10.3 | Escalation nodes are visually distinct | Inspect the rail after an escalation | Escalation markers look different from ordinary event nodes |
| B10.4 | Overlapping events alternate lanes | Cause 2+ events within a very short time window | Nodes alternate above/below the track rather than overlapping illegibly |
| B10.5 | Hover/focus shows details | Hover or keyboard-focus any node | A popover shows timestamp + description; screen-reader label present too |

### B11. Admin pages

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B11.1 | Non-admin blocked from admin routes | Log in as a non-admin responder, navigate to `/admin/responders` | Access denied / redirected |
| B11.2 | Admin can view Responder Management | Log in as admin, navigate to `/admin/responders` | Page loads with responder list/management UI |
| B11.3 | Admin can view Responder Performance | Navigate to `/admin/performance` | Page loads with performance data |

### B12. Maps

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| B12.1 | OSM map renders (no Google key configured) | Open an incident with a confirmed location, no Google Maps key set | OSM-based map backdrop renders with marker(s) |
| B12.2 | Google map renders (if key configured) | Same, with a Google Maps key configured | Google-based map renders instead, with markers only (no drawn route line, per current scope) |
| B12.3 | Live position updates on map | During an active call with GPS tracking | Marker position updates as the caller's live position changes |
| B12.4 | Route line renders on OSM map | After a route-to-safety is set | Route polyline and destination marker are visible on the OSM map |

---

## Part C — Cross-cutting / regression checks

These check behaviors that span both apps or are easy to silently regress.

| # | Test | Steps | Expected Result |
|---|------|-------|------------------|
| C1 | App never gets stuck on exit under bad network | For each exit path (call end, SOS 3-tap exit, delivery-instructions submit), throttle/drop network right before exiting | App always returns to a normal screen within ~10 seconds max, never an infinite spinner or stuck black screen |
| C2 | Double-close doesn't spam console errors | End a call or SOS twice in quick succession (e.g. tap End button then immediately tap again if possible) | No repeated "WebSocket already in CLOSING/CLOSED state" console error flood |
| C3 | Reconnect doesn't duplicate incidents | Force a mid-call network drop and reconnect | Still exactly one incident for that session — no duplicate incident created |
| C4 | Negation phrasing never escalates severity anywhere it's used | Test the same negated phrase ("no weapon," "unarmed") across: call persona severity, SOS observer severity, and the dashboard's suggested-service-kind (nearby help tile should not suggest hospital/fire based on a negated injury mention) | Consistent non-escalation everywhere |
| C5 | Coded phrases stay in sync across surfaces | Pick one code from `shared/codes.ts` (e.g. "extra spicy" → harmed-now) | The exact same phrase/meaning appears consistently in: the voice persona's own phrasing, the checkout coded-item decode, and the dashboard's transcript highlighting |
| C6 | No safety data ever leaks into the disguise-facing UI | Throughout every Part A test, watch the Order Placed / Home / Cart screens | At no point does real safety/dispatch language appear on any screen the "attacker"/bystander might see over the caller's shoulder |
| C7 | Deployed URLs match expected hosting targets | Confirm | Web app is served from `quickbite-5cde0.web.app`, dashboard from `quickbite-5cde0-dashboard.web.app` — not mixed up |
| C8 | Light theme only on dashboard | Open dashboard in a browser/OS set to dark mode preference | Dashboard still renders in light theme (per project convention — no dark mode) |
| C9 | No native browser dialogs anywhere | Trigger every confirm/resolve/delete-like action across the dashboard | No `window.confirm`/`alert`/`prompt` native dialogs appear — only custom in-app modals |

---

## Suggested test run order for a demo rehearsal

1. Part A1–A2 (disguise + hidden trigger) — 5 min
2. Part A3–A5 (full SOS flow on a real phone) with dashboard open on Part B3–B6 — 15 min
3. Part A6–A9 (full voice call, including one deliberate silence test and one deliberate network-drop test) with dashboard open — 20 min
4. Part A10–A11 (delivery instructions + coded order) — 10 min
5. Part B1–B2, B7–B10 (queue, alerts, replay, timeline) using incidents created above — 15 min
6. Part B9 (history/search) once at least one case is resolved — 5 min
7. Part C (regression sweep) — 10 min

Total: roughly 80 minutes for a full pass. For a quick pre-demo smoke test, run A2.3, A3.1, A4.1, A5.2, A6.2–A6.5, A9.1, B1.1, B3.3, B5.6, B8.1 only (~15 minutes).
