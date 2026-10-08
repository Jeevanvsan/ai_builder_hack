// AI caller voice, for recording demo videos only (started from /demo-control). A second Gemini Live session plays
// the CALLER: it hears Mia's voice directly (her audio stream, not through the speaker) and its spoken replies are
// mixed into the call's microphone, so Mia, the dashboard, the transcript and the call recording all treat it as the
// caller. The real call is unchanged; this only replaces the person holding the phone.
import { Modality, type LiveServerMessage } from '@google/genai'
import { AI_MODELS } from '../../../shared/aiModels.ts'
import { liveConnect } from './gemini/aiLogic.ts'

// Ready-made caller scenarios. Each is the full brief for the AI caller: what is happening and how she sounds.
export const SCENARIOS: Record<string, { label: string; text: string }> = {
  chase: {
    label: 'Chase (open)',
    text: `You can talk freely: when Mia first asks, say "talk".
A man on a black motorbike has been following you for about ten minutes and is now chasing you while you run along the road. One man, dark jacket, black helmet; you could not read the number plate.
You are on CCSB Road near Vazhicherry market in Alappuzha.
You are not hurt. You have your phone and nothing else.
If asked for an email for the case report, it is priya1661@yopmail.com. Always say it spelled, in one go, the first time: "p, r, i, y, a, one, six, six, one, at y, o, p, m, a, i, l, dot com".

HOW YOU SOUND: terrified and running for your life. Fast, breathless, voice shaking and cracking, gasping between words, sometimes close to tears. Short broken bursts, stammering and repeating words ("he's — he's right behind me", "please, please hurry"). Glance back and plead ("oh god, he's still there", "I can't — I can't breathe"). A little calmer when Mia gives a clear direction, then afraid again. Relieved but shaky and tearful once you reach safety.`,
  },
  domestic: {
    label: 'Domestic (covert)',
    text: `Your husband is in the same room. He has been hitting you and shouting at you, and he hears every word, so you must sound like you are only ordering food. Never say help, police, husband, hit or hurt.

ANSWER ONLY THE QUESTION MIA HAS JUST ASKED, with the matching line below, then stop. Never give an answer to a question she has not asked yet (do not say "extra spicy" until she offers the food choices). Say the line with its stammers and pauses exactly as written:
- Talk freely or keep it like an order? → "O-order... order, please."
- For yourself or for someone else? → "It's... it's f-for me. For myself."
- The food choices (extra spicy, extra pepperoni, garlic bread...)? → "Uh... the, the extra... extra spicy. Please."
- How many pizzas? → "J-just... one. One pizza."
- Hand it to you or leave it at the door? → "Hand it... h-hand it to me. Please."
- Napkins (a few or a whole pack)? → "Just... just a few. A few napkins."
- Collect it outside or bring it in? → "I... I can't come out. Bring it... bring it in."
- Any weapon / size question? → "N-no... no, just... regular. That's all."
- The address? → "H-house number... two, three, two. Near... near Vazhicherry market. V, A, Z, H, I, C, H, E, R, R, Y. Alappuzha."
- Asked to spell the address (again)? → say the house number as words, never spelled, and spell only the area: "House number two, three, two... Vazhicherry: V, A, Z, H, I, C, H, E, R, R, Y."
- Is that right? (a correct read-back) → "Y-yes. Yes, that's right."
- An email? → "It's... p, r, i, y, a, one, six, six, one... at y, o, p, m, a, i, l... dot com."
- Anything else / goodbye? → "N-no. That's... that's all. Th-thank you."
For any other question, answer in the same frightened, stammering way, in a few words.

HUSBAND LINE: "Who are you talking to?! Huh? Who is it?!"
ASIDE LINE: "It's just... food. For dinner. Give me a minute."
(Say the aside line only when a note tells you to; it is said to him, not to Mia. Never say any other aside.)

HOW YOU SOUND: terrified and trying desperately to hide it. Hushed, close to a whisper, voice trembling and catching, shaky breaths between words, swallowing hard, as if you keep glancing at him. Never cry out or raise your voice.`,
  },
}
export const DEFAULT_SCENARIO = SCENARIOS.chase.text

const persona = (scenario: string) => `You are role-playing a CALLER on a live phone call, for a demo recording.
You are Priya, a young woman in Alappuzha, Kerala, speaking Indian English.
The other voice is Mia, from a food-delivery order line that is secretly an emergency line.

YOUR SITUATION AND HOW YOU SOUND (follow it closely, the sound matters most):
${scenario}

RULES:
- Speak only as Priya. One or two short spoken lines per turn. No stage directions; never describe your own tone in words.
- Answer ONLY what Mia has just asked, then stop. Never volunteer the answer to a later question. When she offers choices, pick one by saying the food word (or the plain answer if she asks plainly).
- Say your lines with any stammers, repeats and "..." pauses written in them; they are how you sound.
- When she asks for an email, a name or an address, give it spelled letter by letter straight away, without pausing in the middle, so she doesn't have to ask twice.
- Stick to your situation; if she asks something it doesn't cover, give a short, plausible answer that fits it.
- When she gives directions, follow them and say so ("okay, turning left"). Never name a road, place or landmark of your own and never say where you are heading: only repeat places Mia herself mentions.
- Only say you have arrived and are safe after Mia says you have reached the place.
- Never talk while Mia is still speaking. Wait for her to finish.`

const IN_RATE = 16_000
const OUT_RATE = 24_000

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export type AiCallerHandle = { stop: () => void }

// `out` is the call's microphone mix; `speaker` (optional) also plays the caller's voice on the phone so a screen
// recording hears both sides.
export async function startAiCaller(o: { ctx: AudioContext; out: AudioNode; speaker?: AudioNode; mia: MediaStream; scenario: string; voice: string }): Promise<AiCallerHandle> {
  const { ctx } = o
  let stopped = false
  let nextAt = 0
  const playing = new Set<AudioBufferSourceNode>()

  // The aside to the husband (the scenario's ASIDE LINE) is triggered by the app right after the caller's first
  // answer, because a prompt alone did not make the model say it (INC-MUZMBPLA). That whole reply is played at a
  // fraction of the volume: a voice model cannot be told to whisper reliably.
  const asideLine = /ASIDE LINE: "([^"]+)"/.exec(o.scenario)?.[1] ?? null
  let turns = 0
  let quiet = false

  const play = (b64: string) => {
    const bin = atob(b64)
    const pcm = new Int16Array(bin.length / 2)
    for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16
    const buf = ctx.createBuffer(1, pcm.length, OUT_RATE)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768
    const src = ctx.createBufferSource()
    src.buffer = buf
    const level = ctx.createGain()
    level.gain.value = quiet ? 1 : 1 // her aside to him is at normal volume too
    src.connect(level)
    level.connect(o.out)
    if (o.speaker) level.connect(o.speaker)
    nextAt = Math.max(nextAt, ctx.currentTime + 0.05)
    src.start(nextAt)
    nextAt += buf.duration
    playing.add(src)
    src.onended = () => playing.delete(src)
  }

  // The angry husband (the scenario's HUSBAND LINE): a separate male voice in the room, played into the call so Mia
  // hears another person there. He only ever says his one line, when the app tells him to.
  const husbandLine = /HUSBAND LINE: "([^"]+)"/.exec(o.scenario)?.[1] ?? null
  let husband: { say: (line: string, done: () => void) => void; close: () => void } | null = null
  if (husbandLine) {
    let hNext = 0
    let onDone: (() => void) | null = null
    const hSession = await liveConnect({
      model: AI_MODELS.liveCall,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
        systemInstruction: 'You are an angry, controlling Indian man in his 30s in a small flat, voicing one line for a film. When you are given a line, shout it exactly as written, harsh, aggressive and suspicious, then stop. Never say anything else, never reply to anyone.',
      },
      callbacks: {
        onopen: () => {},
        onmessage: (m: LiveServerMessage) => {
          if (stopped) return
          for (const p of m.serverContent?.modelTurn?.parts ?? []) {
            if (!p.inlineData?.data || !p.inlineData.mimeType?.startsWith('audio/')) continue
            const bin = atob(p.inlineData.data)
            const buf = ctx.createBuffer(1, bin.length / 2, OUT_RATE)
            const ch = buf.getChannelData(0)
            for (let i = 0; i < ch.length; i++) ch[i] = ((bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16) / 32768
            const src = ctx.createBufferSource()
            src.buffer = buf
            // Deeper and heavier: played slightly slower (lower pitch) through a bass boost.
            src.playbackRate.value = 0.86
            const bass = ctx.createBiquadFilter()
            bass.type = 'lowshelf'
            bass.frequency.value = 220
            bass.gain.value = 9
            const level = ctx.createGain()
            level.gain.value = 0.85 // across the room, a little further from the phone than she is
            src.connect(bass)
            bass.connect(level)
            level.connect(o.out)
            if (o.speaker) level.connect(o.speaker)
            hNext = Math.max(hNext, ctx.currentTime + 0.05)
            src.start(hNext)
            hNext += buf.duration / src.playbackRate.value
          }
          if (m.serverContent?.turnComplete && onDone) {
            const done = onDone
            onDone = null
            setTimeout(done, Math.max(0, (hNext - ctx.currentTime) * 1000))
          }
        },
        onerror: () => {},
        onclose: () => {},
      },
    }).catch(() => null)
    if (hSession) {
      husband = {
        say: (line, done) => {
          onDone = done
          try { hSession.sendClientContent({ turns: `Shout this line now, exactly: "${line}"` }) } catch { done() }
        },
        close: () => { try { hSession.close() } catch { /* closed */ } },
      }
    }
  }

  const session = await liveConnect({
    model: AI_MODELS.liveCall,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voice } } },
      outputAudioTranscription: {},
      systemInstruction: persona(o.scenario),
    },
    callbacks: {
      onopen: () => console.info('[QuickBite demo] AI caller connected'),
      onmessage: (m: LiveServerMessage) => {
        if (stopped) return
        if (m.serverContent?.turnComplete) {
          turns++
          quiet = false
          // After her first answer: he shouts (his own voice, in the room), then she answers him under her breath.
          if (turns === 1 && asideLine) {
            const aside = () => {
              if (stopped) return
              quiet = true
              try { session.sendClientContent({ turns: `(Note, not Mia: your husband just asked who you are talking to. Say ONLY this to him now, nothing else, then stop: "${asideLine}")` }) } catch { /* closed */ }
            }
            if (husband && husbandLine) husband.say(husbandLine, () => setTimeout(aside, 300))
            else setTimeout(aside, 400)
          }
        }

        for (const p of m.serverContent?.modelTurn?.parts ?? []) if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('audio/')) play(p.inlineData.data)
        // Mia started talking over the caller: drop what is still queued, like a person stopping mid-sentence.
        if (m.serverContent?.interrupted) { playing.forEach((s) => { try { s.stop() } catch { /* ended */ } }); playing.clear(); nextAt = 0 }
      },
      onerror: (e: unknown) => console.warn('[QuickBite demo] AI caller error', e),
      onclose: () => console.info('[QuickBite demo] AI caller closed'),
    },
  })

  // Mia's voice → 16 kHz PCM → the caller session.
  const source = ctx.createMediaStreamSource(o.mia)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const sink = ctx.createGain()
  sink.gain.value = 0
  proc.onaudioprocess = (e) => {
    if (stopped) return
    const input = e.inputBuffer.getChannelData(0)
    const ratio = ctx.sampleRate / IN_RATE
    const n = Math.floor(input.length / ratio)
    const out = new Int16Array(n)
    for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)])) * 0x7fff
    try { session.sendRealtimeInput({ audio: { data: toBase64(out.buffer), mimeType: `audio/pcm;rate=${IN_RATE}` } }) } catch { /* closed */ }
  }
  source.connect(proc)
  proc.connect(sink)
  sink.connect(ctx.destination)

  return {
    stop: () => {
      stopped = true
      proc.disconnect()
      source.disconnect()
      playing.forEach((s) => { try { s.stop() } catch { /* ended */ } })
      try { session.close() } catch { /* closed */ }
      husband?.close()
    },
  }
}
