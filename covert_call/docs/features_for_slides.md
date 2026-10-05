# QuickBite: feature list for the deck

Every feature, including the small ones, grouped for the slides. Status: ✅ live · 🛠 built, not yet deployed · ⏳ in progress · 📋 planned.

## 1. Four ways to ask for help (the disguise)
- ✅ **Call to order (covert):** Gemini Live "Mia" takes a food order where food items secretly mean danger. Mia says each meaning out loud in the same sentence, so the caller never memorises codes.
- ✅ **Free to talk (open mode):** the same call with no disguise, where Mia acts as a calm dispatcher with first-aid and safety advice. She switches back to the disguise instantly if someone comes near.
- ✅ **Click & order:** a coded cart order (menu items stand for danger), decoded at checkout.
- ✅ **Silent SOS:** a hidden double-tap on the heart. Gemini silently watches the back camera and listens, never speaks, and reports through tool calls.
- ✅ **Hidden demo call:** a long-press on the logo runs a safe practice call that never reaches responders.
- ✅ **Zero-trace exit:** the call or SOS leaves no visible trace in the app.

## 2. What the AI does during a call (Gemini Live)
- ✅ Live decoding into structured facts (tool calls): danger tags, urgency, people count, address.
- ✅ **Multilingual:** Malayalam, Hindi, Tamil, Manglish and Hinglish, replying in the caller's own language.
- ✅ Always asks for the exact location; follow-up questions only when needed; aims for a 3-minute call.
- ✅ **Voice stress score** from tone, pace and pitch.
- ✅ **Caller estimate** (age group and gender, marked unconfirmed), to flag a child or elderly caller.
- ✅ **Coercion detection:** a second voice takes over, a scripted tone, a forced "cancel".
- ✅ **Vehicle number plate** capture with the state and region decoded (no owner lookup).
- ✅ **Live route to safety:** turn-by-turn directions to the nearest police station or hospital, given as directions to "meet the rider".
- ✅ **Responder → caller messages:** Mia passes them on as delivery chat, so the disguise holds.
- ✅ Camera scene understanding (back camera) and photo vision.
- 🛠 **Motion alerts:** the phone's sensors detect the phone being snatched, a fall, running, or the phone going still. These go to the dashboard and, as a silent note, to Mia; running unlocks route guidance.

## 3. After the call (Gemini)
- ✅ Case summary with field confidence.
- ✅ Third-party leakage check (redacts other people's details).
- ✅ **Linked cases:** cross-incident correlation (same person, place or vehicle).
- ✅ Nearby-help context (Google Search grounding).
- ✅ Dispatch bulletin.

## 4. Responder dashboard
- ✅ Live queue, severity, AI recommendation, critical-mode alerts, keyboard shortcut for the next urgent case.
- ✅ Live map case board with holographic evidence cards (threat, voice stress, seen & heard, linked cases, nearby help, route).
- ✅ Live transcript, listen-in audio, live camera feed, replay scrubber, timeline.
- ✅ **Scene sketch:** a live hand-drawn diagram built only from reported facts (indoor, outdoor or unknown setting; suspect, weapon, vehicle and plate, caller, route).
- ✅ Message caller via Mia (quick replies and free text).
- ✅ Evidence recordings to Drive, team notes, case history, analytics, responder management and performance.
- ✅ Natural-language search.

## 5. Trust, identity and false calls
- 🛠 **Device ID:** an invisible anonymous sign-in links repeat calls from the same phone.
- 🛠 **Mobile OTP verification** ("Verify your number for delivery updates"). The number is stored only where responders can read it.
- 🛠 **AI credibility check (false or prank call detection):** a score with reasons, based on story consistency, GPS versus stated address, voice versus words, camera and sound check, and device history. Advisory only: it never dismisses a call.
- 🛠 **Responder outcome marking** (genuine / false alarm / prank), which builds the device's history.
- 🛠 **Trusted contacts** ("Share live order updates" in the app): an automatic email alert with the location when a call turns serious.

## 6. Architecture and security
- ✅ Firebase Hosting (caller app, dashboard, landing page) + Firestore real time.
- ✅ **Firebase AI Logic + App Check** (reCAPTCHA Enterprise): no Gemini key in the web app.
- ✅ Secret scan on every push (gitleaks); masked sample env files.
- ✅ Separate staging site.
- 📋 Multi-agent backend (ADK on Cloud Run): dispatcher, verification and resource agents.
- 📋 Dashboard and native app moved to AI Logic; then the old key is deleted.

## 7. Platforms and docs
- ✅ React web app (no install), React Native Android APK, landing page with demo videos, user manual, privacy policy.
- ✅ Anonymised BigQuery export (sandbox) for city-level trends.

## 8. Proof
- 🛠 **AI accuracy test** (harness built, run pending): 30 simulated calls (covert, open, coercion, negation, benign, 6 languages), reporting decode accuracy, false-alarm rate, time to first alert and disguise kept. Excel report for the deck.
