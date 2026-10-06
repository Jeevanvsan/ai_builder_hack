# Test media credits

Used only by the AI accuracy test (`eval/run.ts`) to feed Mia camera frames and background sound.

| File(s) | Source | License |
|---|---|---|
| `fire/f01-f08.jpg` | Frames (1 fps) from [Video of house fire 02.webm](https://commons.wikimedia.org/wiki/File:Video_of_house_fire_02.webm), Wikimedia Commons | CC BY-SA 4.0 |
| `knife/k1.jpg`, `sos/s01-s06.jpg` (darkened copies) | [18-03-25-Küchenutensil-DSCF1428.jpg](https://commons.wikimedia.org/wiki/File:18-03-25-K%C3%BCchenutensil-DSCF1428.jpg), Daniela Kloth, Wikimedia Commons | GFDL 1.2 |
| `src/gunshot.wav` (mixed into `audio/*.pcm`) | [9 mm gunshot-mike-koenig-123.wav](https://commons.wikimedia.org/wiki/File:9_mm_gunshot-mike-koenig-123.wav), Mike Koenig, Wikimedia Commons | CC BY-SA 4.0 |
| `src/shout.wav`, `src/captor.wav` | Synthetic: Windows text-to-speech (Microsoft David) | Own work |
| `plate/p1.jpg` | Synthetic: drawn number plate `KL 07 CD 4521` (not a real vehicle) | Own work |

`audio/*.pcm` are 16 kHz mono 16-bit PCM, the format the app streams to Gemini Live.
