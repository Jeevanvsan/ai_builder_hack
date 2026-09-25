# QuickBite — solution deck (content)

*Slide-by-slide content for the AI Builder Cup submission deck (Epic 5.3). This is the source text; drop it into
Slides/PowerPoint for the actual file. Keep it honest — see the competitive-honesty framing (plan §8) and the
theme-fit answer (theme-fit.md).*

---

## Slide 1 — Title
**QuickBite**
An AI that lets a person in danger ask for help when asking out loud isn't safe.
AI Builder Cup 2026 · Sustainability & Social Impact
Built on Gemini + Firebase / Cloud Run.

## Slide 2 — The problem
When someone is coerced, watched, or held, the normal ways to get help are the exact things they can't do —
call 911, shout, open a safety app. Openly asking for help can make it more dangerous.

## Slide 3 — The idea
A food-delivery app that is indistinguishable from an ordinary one, and is actually a covert channel to a response
team. Disguised request in → coordinated response out.

## Slide 4 — How it works (the core)
- A live call to "the restaurant". Gemini Live plays an employee, **Mia**, who asks coded menu questions and states
  each code's real meaning in the same breath ("extra pepperoni tells me someone near you has a weapon").
- The AI extracts structured incident data **live** and streams it to a responder dashboard field-by-field,
  starting the instant the call begins — not batched at the end.

## Slide 5 — The money shot (demo)
Split screen: disguised call on one device, dashboard populating live on the other — people count, danger
indicators, location, voice stress, all appearing mid-call. *(This is the live demo / the video's central beat.)*

## Slide 6 — More than a chatbot: a system
- **Sees & hears:** ~1 fps camera frames + background-sound analysis (a gunshot or shouting escalates severity).
- **Advises:** gives the caller brief, disguised safety guidance, logged for the responder.
- **Four ways in, one backbone:** live call · silent tap (+ photo, read by Gemini) · coded "click & order" ·
  heart-double-tap silent SOS (black "phone-off" screen, front+back camera, silent observer).
- **Responder console:** live queue, severity ranking, claim/resolve, map, consolidated case record, live video
  (switchable front/back), Drive-archived footage.

## Slide 7 — Gen AI implementation (Technical Merit, 40%)
- Gemini Live: real-time disguised conversation, native audio stress/tone, incremental function-calling extraction,
  camera + background-sound understanding, session resumption for long/video sessions.
- Gemini structured output: post-call consolidation + third-party leakage check + photo vision.
- The impact is only possible *because* of this — a scripted bot or a form would break the disguise.

## Slide 8 — Google stack
| Layer | Product |
|---|---|
| Conversational AI | Gemini Live API |
| Structured reasoning | Gemini API (structured output) |
| Hosting / compute | Firebase Hosting / Cloud Run |
| Database + realtime | Firestore (live listeners) |
| Maps / geocoding | Google Maps JS + Geocoding |
| Dev keys | Google AI Studio |
Upgrade path (not built, honest): Vertex AI for production quota/IAM; Grounding with Google Maps for location
plausibility.

## Slide 9 — Impact & theme fit (Problem Alignment, 25%)
Societal impact via the theme's own approaches — **resilience strengthening** and **community support**: a layer of
help for people for whom the normal path is exactly what they can't use. *(Full wording in theme-fit.md.)*

## Slide 10 — Honesty on originality (Innovation, 25%)
Individual pieces exist elsewhere (mesh SOS, anonymisation SaaS, crash detection). The **novel combination** —
disguised persona + in-breath code-teaching + real-time mid-call extraction + one backbone spanning disguised
request and identified response — is unclaimed (two adversarial research passes, plan §8).

## Slide 11 — UX & design (10%)
Disguise realism is the product: the app must read as an ordinary delivery app at every screen. Zero-trace exit,
no confirmation that could reveal intent, light coherent theme across app and dashboard.

## Slide 12 — Live links + close
- App: https://quickbite-5cde0.web.app
- Dashboard: https://quickbite-5cde0-dashboard.web.app
- Repo: (GitHub URL) · Video: (link)
"An AI that lets a person in danger ask for help when asking out loud isn't safe."

---

### Notes for whoever builds the actual slide file
- Lead with the split-screen demo (slide 5) — it's the most convincing 15 seconds.
- Don't overclaim: native app is a staged demo, not the live-deployed link; the live link is the web app +
  dashboard. Real-world dispatch is out of scope (the "response" is the dashboard incident).
