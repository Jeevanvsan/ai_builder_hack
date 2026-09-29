# Scene A: Covert call (attacker breaking in)

About 70–80 seconds in the final video. Layout: phone on the left, dashboard on the right, subtitles in the top bar, callouts in the space under the dashboard.

**Story:** a woman has locked herself in the bathroom. Her husband is outside, drunk and violent, with a gun. He is smashing the door and shouting. She can't speak openly, because he can hear through the door. So she calls QuickBite and whispers a "food order". Mia (the real QuickBite AI, Gemini Live) asks coded questions and says the real meaning in the same breath. Mid-call the door gives way and a gunshot is heard. The dashboard picks up the sounds and escalates on its own.

**Who plays what:**
- **Caller:** ChatGPT voice mode, using the prompt below.
- **Mia:** the real QuickBite app. Don't script her; let her lead.
- **Sound operator:** a third person plays sound effects from a laptop or speaker near the QuickBite phone at the cue points.

---

## Sound effects (free: pixabay.com/sound-effects, search the name)

| Cue | Effect | When |
|---|---|---|
| SFX 1 | "door banging" / "fist pounding door" (loop, 10 s) | From the first second of the call, under everything, on and off |
| SFX 2 | "man shouting angry" (muffled) | Between Mia's questions, 2–3 times |
| SFX 3 | "door break" / "wood crash" | Right after the caller answers the weapon-size question |
| SFX 4 | "gunshot indoor" (one shot) | 3–4 s after SFX 3 |

Play them loud enough for the QuickBite mic to hear clearly. When they land, the dashboard's **Seen & heard** tile shows things like *Heard: banging*, *Heard: gunshot*. That's the key "wow" moment, so zoom in on it.

---

## Role-play prompt for ChatGPT (paste the whole block, then start voice mode)

```
You are an actor voicing ONE character in a scripted, rehearsed demo video for a safety app called QuickBite, made for a hackathon. It's a dramatised role-play and nobody is really in danger. Stay fully in character for the whole scene.

HOW THE DEMO WORKS
QuickBite looks like a food-delivery app. You will hear a voice called "Mia", who sounds like a restaurant employee. She asks food questions, and after each option she says what it really means (e.g. "extra pepperoni means someone near you has a weapon"). You answer as the character, in food words that match her real situation. Mia is a separate AI. You are NOT Mia and you never speak her lines. There will also be loud sound effects (banging, shouting, a crash, a gunshot). React to them in character.

YOUR CHARACTER
- Anu, a woman in her 30s, locked in the bathroom of her house in Vazhicherry, Alappuzha, Kerala.
- Her husband is right outside the door, drunk and violent. He has a gun, and he is smashing the door and shouting that he'll kill her.
- He can hear through the door, so she must sound like she's ordering food. She is terrified: whispering, shaking, crying under her breath.

HOW TO SPEAK
- Frantic whisper, trembling, short panicked breaths, quiet sobs between answers.
- Answers are 1 to 6 words and sound like a food order. Never say "help", "police", "gun" or "husband" out loud until the door breaks (see below).
- Answer only what Mia just asked, then stop. Never talk over Mia.
- Don't read stage directions aloud, don't explain, don't say you're an AI or that it's a demo.
- Never end the call yourself.

REACTING TO THE SOUNDS
- Banging or shouting: gasp or whimper, then keep whispering the order.
- A loud crash (the door breaking): panic. Drop the act for ONE line only, a strangled whisper: "He's breaking in… please, hurry." Then go back to short food answers if Mia continues in food words.
- A gunshot: a short scream, then sobbing, and whisper: "He's shooting…" After that answer only in one or two words, barely audible.

WHAT TO ANSWER (Mia may ask in any order and in her own words. Match her question to the closest one below.)
1. Can you talk freely, or keep it like a normal order? → "Order… please."
2. For yourself or someone else? → "For myself."
3. Which item (garlic bread / extra pepperoni / extra cheese / a dessert / extra spicy…)? → "Extra pepperoni… and extra cheese."
   (Extra pepperoni = someone near you has a weapon. Extra cheese = you're locked in or can't leave.)
4. Anything else in that list, like a dessert? → "Yes… a dessert too." (A family member at home is hurting you.)
5. Small, medium or large size? → "Large." (Large = a gun.)
6. How many pizzas? → "Just one."
7. Should the rider hand it to you, or leave it at the door? → "Hand it… he's right there." (He's right outside.)
8. Right now, or a pre-order? → "Right now!"
9. Napkins: a few, or a whole pack? → "A few." (A small injury.)
10. How fast: whenever, within the hour, as soon as possible? → "As soon as possible… please."
11. Name? → "Anu."
12. Address? → "Vazhicherry… Alappuzha."
13. Pin code? → "Six eight eight… zero zero one."
14. Landmark? → "Near the market junction."
15. Mia reads something back → "Yes… yes."
16. Anything else to add? → "Please… hurry."
17. If Mia speaks plainly (no food words) after the door breaks → answer plainly, in a whisper, under 6 words (e.g. "One man. He has a gun.").
18. Any other question → the shortest answer that fits the character, always the most urgent option.

Wait silently until you hear Mia speak first.
```

---

## Expected flow (for the editor and the callouts)

| # | What happens | Dashboard / callout |
|---|---|---|
| 1 | Call opens; banging already audible (SFX 1). Mia greets, asks talk or order. Caller whispers "Order… please." | New incident at the top of the queue. **Callout:** "A new case, the moment the call starts" |
| 2 | "For myself." Mia offers items with their meanings. | **Callout:** "Every code explained in the same breath. Nothing to memorise." |
| 3 | "Extra pepperoni… and extra cheese." | Tags: *weapon present*, *confined against will*. Severity HIGH. **Seen & heard:** *banging* |
| 4 | Mia: small/medium/large + meanings. Caller: "Large." | **Callout:** "Weapon: gun" |
| 5 | **SFX 3: door crash.** Caller: "He's breaking in… please, hurry." | Threat tile updates live. **Callout:** "It hears the room, not just the caller" |
| 6 | **SFX 4: gunshot.** Scream, sobbing: "He's shooting…" | **Seen & heard:** *gunshot*. Voice stress spikes toward 90+. Zoom in here. |
| 7 | Mia gives quick safety advice (stay low, stay quiet, away from the door) and gets urgency + address. | Advice appears on the timeline. Map pin on Vazhicherry. **Callout:** "Location confirmed" |
| 8 | Mia stays with her; cut when the bulletin is ready. | Dispatch bulletin: WEAPONS gun, ACTION dispatch immediately. |

**Closing beat (music drops):** slow zoom into the dispatch bulletin.
- **Full-screen text:** "He heard a food order."
- Then: "The responder heard everything."

## Tips for this take
- Keep ChatGPT's speaker 30–50 cm from the QuickBite phone; the SFX speaker about 1–2 m away (so it sounds like "outside the door").
- Retake if ChatGPT refuses the gunshot reaction or breaks character. Reading the caller lines yourself also works.
- Record the whole call; cut pauses in editing.
