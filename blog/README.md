# Top 50 blog: publishing kit

Everything the AI Builder Cup "Top 50 stories" email asks for: the Medium post, its images, the LinkedIn posts, and the submission checklist.

| File | What it is |
|---|---|
| `medium_post.md` | The post. This is the version to edit. |
| `medium_post.html` | The same post, rendered for copying into Medium. Rebuild it after editing the Markdown (see the end of this file). |
| `images/01-cover.png` … `07-google-maps.png` | The seven images, in post order. The team photo (image 8) is yours to add. |
| `images/src/` | The HTML sources of the five designed images, the screenshots they use, and `render.mjs`. |
| `linkedin_post.md` | Two LinkedIn posts, one for Ameen and one for Jeevan. |
| `build_html.py` | Rebuilds `medium_post.html` from the Markdown. |

## Before publishing

1. **The post links the staging app**, https://quickbite-5cde0-staging.web.app, which runs QuickOne with Google Maps. Don't switch it to the main site (https://quickbite-5cde0.web.app): main deliberately stays on the older QuickBite build as the fallback.
2. **Check the team line at the end of the post.** It says who built what; correct it if needed.
3. **Optional:** the post links the staging app without inviting anyone to call. Every call still rings both dashboards (main and staging share one database) and spends Gemini quota. If that's a worry before the 4 Dec finale, link only the landing page.

## Publish on Medium

1. Open `medium_post.html` in Chrome or Firefox.
2. Click inside the article, press Ctrl+A (Cmd+A on a Mac), then copy.
3. On Medium, click **Write** and paste.
4. **Title and subtitle:** the first line becomes the title. Select the second line and make it the subtitle (small "T"). Delete the byline line if you don't want it in the body.
5. **Images:** each yellow line marks an image slot. There are eight: the seven images in `images/`, plus your team photo under "Meet Team NexMind". Click an empty line there, choose **+ → Image**, upload the file named in the yellow line (for slot 8, your group photo), type the caption under the image, and add the alt text from the image menu. Then delete the yellow line. The table below lists the same details.
6. **Code blocks:** if a snippet pasted as plain text, select it and press Ctrl+Alt+6 (Cmd+Option+6) to make it a code block.
7. **Image width:** use the wider layout for the diagrams (02, 03, 05, 06) so their text stays readable.
8. **Publish settings:** add up to five tags. Suggested: `Top50Stories`, `AI Builder Cup`, `Google Cloud`, `Gemini`, `Social Impact`. Make sure the preview image is the cover (01).
9. Publish, then copy the story URL.

| # | File | Caption | Alt text |
|---|---|---|---|
| 1 | `01-cover.png` | On the phone, an everyday ordering app. On the responder's screen, a live, located emergency. | The QuickOne app on a phone next to the responder console showing a live incident on a Google map |
| 2 | `02-four-ways-in.png` | Four ways in, from "I can talk" to "I can't touch the phone again". | Four QuickOne screens: the home screen with Call to order, an item revealing its meaning, delivery instructions, and the black SOS screen |
| 3 | `03-one-meaning-many-covers.png` | The meanings never change. Only the words do, so nobody has anything to memorise. | The same three meanings expressed in the words of five services, beside two item screens showing the same hidden meaning |
| 4 | `04-responder-console.png` | A test call on the console. Each food phrase is decoded in red: "extra spicy" means the caller is being harmed now. A coercion signal is flagged too, because a second voice asked "Who are you talking to?" | The responder console: threat, voice stress, seen-and-heard evidence, nearby help and linked cases on a map, with the conversation decoded beside it |
| 5 | `05-architecture.png` | During a call, only the phone talks to Gemini Live, and only Firestore connects the phone to the console. | Architecture: the caller's phone talks to the Gemini Live API and Google Maps Platform, writes to Cloud Firestore, and the responder console reads Firestore in real time |
| 6 | `06-one-answer.png` | One answer, end to end. The person in the room hears "garlic bread". The responder sees a high-severity chase with a route. | One answer traced end to end: Mia's coded question, the caller's answer, the function call, the rules in code, Firestore and the console |
| 7 | `07-google-maps.png` | A test chase on MG Road, Kochi: the live route to the nearest police post, and Street View 30 m from the caller. | The console's Google map with the caller's live route to a police post, beside a Street View panorama near the caller |
| 8 | Your team photo (optionally saved as `08-team-photo.jpg`) | Team NexMind: Al Ameen N and Jeevan V. | Team NexMind: Al Ameen N and Jeevan V |

## Share on LinkedIn

Use `linkedin_post.md`. Both team members post. Tag Google Cloud, Hack2skill, Experion Technologies, Venkitesh R Mallan and Jiji O R by picking each from the @ dropdown, and keep the four hashtags: #Top50Stories #Hack2skill #AIBuilderCup #GoogleCloud.

## If someone asks

Readers, commenters or judges may ask about the numbers. These are short answers in the post's own words. Each is backed by the code or the test records.

**"How did you get from about 22 inferences to 5 or 6?"** (about 30 seconds)

> On Gemini 3.8 Live, function calls run asynchronously, and by default every function response tells the model to start a new reply. Mia reports facts through tools on almost every turn, often two or three at once, so each response kicked off its own reply: about 22 inferences for a short call, with doubled and cut-off sentences. The API lets you set `scheduling` on each function response: SILENT only adds the result to the context, WHEN_IDLE asks for a reply. So in every batch exactly one response may start a reply (the tool she has to act on, such as an address check or a route, or the last one if she hasn't spoken yet), and the rest are SILENT. We also stopped sending background notes as separate messages, so they now ride inside those tool responses, and we told Mia to batch her tool calls. Every call logs its inference count, and the same test call went from about 22 to 5 or 6.

Follow-ups:

- **"Why not make every response silent?"** We tried. When her turn was only tool calls, she never answered the caller.
- **"Why not declare the tools non-blocking?"** We tried a flag for that. It passed our text tests, but on a real voice call Mia went silent for about 40 seconds, so we kept the default and control replies with `scheduling`.
- **"How do you know the numbers?"** Each incident stores the usage Gemini reports, per task (requests and tokens), and the test harness logs inferences per scenario.
- **"Did quality drop?"** No. The harness scenario still passed all its checks, and Mia answers after tool-only turns.

Where it is in the code:

- the one-reply rule: `batchResponses` in `covert_call/web/src/lib/gemini/tools.ts`;
- notes riding on tool results: `covert_call/web/src/lib/gemini/liveSession.ts`;
- the prompt rule "TOOLS ARE SILENT AND BATCHED": `covert_call/web/src/lib/gemini/persona.ts`;
- the inference count per call: `liveUsage.requests`, `liveSession.ts`.

## Submit

In the Google Form from the email, submit:

- the Medium story URL;
- a clear group photo with every team member in it.

## About the images

- The phone screens were captured from the QuickOne + Google Maps preview build, and the console views from resolved demo cases. Nothing was clicked that writes data.
- In image 4, the test address in the location tile and in the conversation is blurred.
- The console header, which shows the responder's name and the incident number, is cropped out of every console image.
- Google's map attribution is kept, as Google Maps requires.

## Editing the post

- **Text:** edit `medium_post.md`, then rebuild the copy-paste page with `python3 blog/build_html.py`. It needs only the Python standard library.
- **Designed images (01, 02, 03, 05, 06):** edit the HTML in `images/src/`, then run `node blog/images/src/render.mjs` (or name a single figure, such as `01-cover`). It reuses `puppeteer-core` from the `covert_call/` workspace and the same Chrome as the landing page's screenshot script, or `CHROME_PATH` if set.
- **Screenshots (04, 07):** these are crops of console captures. Retake them from a resolved demo case if they ever need to change.
