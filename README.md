# QuickBite

**It looks like a food order. It's a call for help.**

QuickBite helps people who are in danger but can't be seen asking for help: someone being watched, followed, threatened or held. It looks and works like an ordinary food-delivery app, but every way of ordering is a hidden way to reach a response team. Anyone glancing at the screen, or listening nearby, sees and hears someone ordering dinner.

- **Try QuickBite (web app, nothing to install):** https://quickbite-5cde0.web.app
- **Responder dashboard:** https://quickbite-5cde0-dashboard.web.app (judge login: `judge@quickbite.com` / `judge@Quickbite123`)
- **Website and demo videos:** https://quickbite-5cde0-landing.web.app/#demo
- **User manual:** https://quickbite-5cde0-landing.web.app/manual
- **Privacy Policy:** https://quickbite-5cde0-landing.web.app/privacy

### Try it in two minutes

1. Open the responder dashboard on a laptop and sign in with the judge login above.
2. Open the web app on a phone or in another tab. **Allow the microphone** (both the browser's prompt and the browser's mic permission in your phone settings); without it the call can't start.
3. Tap **Call to order**. Mia asks if you can talk: say "order" (someone is listening) or "talk".
4. Answer her food questions. Each code's meaning is spoken with it, e.g. "garlic bread" means someone is following you.
5. Watch the incident appear on the dashboard and fill in live, then hang up and open it for the summary, map and evidence.

Recorded demo incidents to explore (sign in first): [covert call](https://quickbite-5cde0-dashboard.web.app/incident/INC-MUZNKM7N) · [chase, guided to safety](https://quickbite-5cde0-dashboard.web.app/incident/INC-MUZKKVL1)

---

## The problem

When someone is being watched, calling an emergency line openly can make things more dangerous. People have saved lives by pretending to order a pizza when they were really calling for help. QuickBite turns that instinct into something reliable: a disguise that holds up, and a response team that understands exactly what the person means.

## Four ways to ask for help

Every way in starts from the QuickBite home screen, so the person can choose whatever is safe at that moment.

| | Way in | When to use it | What happens |
|---|---|---|---|
| 📞 | **Call to order** | You can talk | An AI "order desk" assistant, Mia, holds what sounds like a normal order call. She offers food choices and says what each one really means in the same sentence, so you only have to pick a food word. For example, *"garlic bread"* means *someone is following you*, and *"two"* means *two people*. If you're free to talk openly, just say so and Mia drops the food cover and speaks like a calm dispatcher. |
| 🛒 | **Click & order** | You can't talk, but you can tap | Some menu items carry a hidden meaning. The quantity tells responders how many people are involved, and the delivery speed tells them how urgent it is. Placing the order sends the alert, and you see an ordinary "order placed" screen. |
| 📝 | **Delivery instructions** | You can't make any sound | A silent form that looks like instructions for the rider. You tap options, add a note, and can attach a photo. |
| 🖤 | **Heart double-tap SOS** | You're being held and can't touch the phone | Double-tap the heart on the home screen. The screen goes black as if the phone is switched off, while the cameras and microphone quietly send what's happening to the response team. Three taps end it. |

Whichever way is used, leaving the app returns to the normal home screen with nothing suspicious left behind.

### What Mia does on a call

- **Speaks the caller's language.** Malayalam, Hindi, Tamil, mixed speech like Manglish and Hinglish, and more; the whole call switches the moment the caller does.
- **Asks only what matters, fast.** What is happening, how many people, where they are and whether the person is still there; a call is designed to finish in about three minutes.
- **Confirms every detail.** The address, email and any name or number plate are spelled back letter by letter and repeated until the caller says yes.
- **Guides people to safety.** If someone is being followed or is on the move, Mia gives turn-by-turn directions to the nearest police station or hospital, with landmarks, and keeps them calm until they arrive.
- **Watches and listens.** The phone camera and background sound are checked continuously for a person, a weapon, a vehicle, an injury, fire, shouting or a gunshot, and any number plate she can read.
- **Notices when something is wrong.** A different voice taking over, a sudden scripted "cancel it", or the phone being grabbed, dropped or the caller running (motion sensors) is flagged to responders without a word said aloud.
- **Passes on responder messages** as ordinary delivery chat ("your rider is five minutes away, keep the door locked").
- **Sends a case report.** After a dangerous call the person can get an email with a reference number to show the police, including the scene sketch, a map and camera snaps.
- **Alerts trusted contacts** by email if a call turns high severity.

## What the response team sees

Trained responders use a separate, sign-in-only dashboard. As the person answers, it fills in a clear picture of the situation in real time:

- what is happening, how many people are involved, injuries and weapons
- where the person is, including while they're on the move, and the nearest police station and hospital
- how stressed the caller's voice sounds, not just what they say
- live video from the phone, and what the AI noticed in the background, such as shouting or breaking glass
- one case record for every incident, with patterns and hotspots over time to help prevent the next one

Responders can guide the person to safety through Mia, who passes directions on as ordinary delivery chat.

The dashboard also includes:

- a **live queue** ranked by severity, with an **Ask AI** search ("woman attacked with a weapon near Vazhicherry")
- an **AI recommendation** for each incident (for example, immediate police dispatch because a weapon was reported)
- a hand-drawn style **scene sketch** of who is where, and **linked cases** for the same place, person or vehicle
- the **route to safety** being followed, the nearest police, hospital and fire station, and the caller's live position
- a **case file** with the full summary, evidence recordings and a dispatch bulletin ready for radio
- **case history, analytics** (hotspot map, trends, time of day) and **responder performance**

## How it's built

- **Gemini Live (gemini-3.8-live)** powers Mia in real time: she hears the caller, sees camera frames and uses 12 function-calling tools to turn food codes into structured danger, coercion, address and route fields.
- **Gemini Flash-Lite** writes the case summary and dispatch bulletin, redacts third-party details and links related cases.
- **Cloud Firestore** streams every field, GPS point, transcript line and responder message to the dashboard as it happens, with no backend server.
- **Firebase** Hosting serves the web app, dashboard and website; **Firebase Auth** secures responders with role-based access.
- **Next:** Gemini keys server-side and ADK dispatch and verification agents on **Cloud Run**.

Architecture diagrams, drawn from the code: [covert_call/docs/architecture](covert_call/docs/architecture/).

## Tested on real calls

8 real voice calls on the deployed app (4 covert, 4 chase): danger and coercion tags reached the dashboard 2–3.5 s before the caller's words were transcribed, every chase run tracked the full ~535 m route to the police station, and AI cost was about **$0.35 per call**.

- [Performance test: 8 real calls (Google Sheets)](https://docs.google.com/spreadsheets/d/1fUVyPzAyDgvhrUJFWH-G35BiqVEt-5Tz/edit?usp=sharing)
- [AI cost per call and cost estimate (Google Sheets)](https://docs.google.com/spreadsheets/d/19s3mMe2nNcZM_Z_tzK-qhx9iXAsQteTn/edit?usp=sharing)

## Permissions

QuickBite asks the browser for the **microphone** (required for calls), the **camera** and **location** (recommended), and on iPhone **motion sensors**. If no permission box appears, open the link in Chrome or Safari rather than inside another app; the call screen and the [user manual](https://quickbite-5cde0-landing.web.app/manual) show the exact steps to allow them.

## Privacy

The microphone, cameras and location are used **only after someone starts one of the four ways to ask for help**. Information goes only to signed-in responders and is never sold or used for advertising. Read the full [Privacy Policy](https://quickbite-5cde0-landing.web.app/privacy).

## Important

QuickBite supports, and does not replace, emergency services. If it is safe to do so, call your local emergency number.

## Team

Built by **Team NexMind**: Al Ameen N and Jeevan V.

## License

[MIT](LICENSE)
