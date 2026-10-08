// AI caller voice, for recording demo videos only (started from /demo-control). A second Gemini Live session plays
// the CALLER: it hears Mia's voice directly (her audio stream, not through the speaker) and its spoken replies are
// mixed into the call's microphone, so Mia, the dashboard, the transcript and the call recording all treat it as the
// caller. The real call is unchanged; this only replaces the person holding the phone.
import { Modality, type LiveServerMessage } from '@google/genai'
import { AI_MODELS } from '../../../shared/aiModels.ts'
import { liveConnect } from './gemini/aiLogic.ts'

export const DEFAULT_SCENARIO = `You can talk freely: when Mia first asks, say "talk".
A man on a black motorbike has been following you for about ten minutes and is now chasing you while you run along the road. One man, dark jacket, black helmet; you could not read the number plate.
You are on CCSB Road near Vazhicherry market in Alappuzha, heading towards the canal.
You are not hurt. You have your phone and nothing else.
If asked for an email for the case report, it is priya.demo@gmail.com (spell it letter by letter when asked).`

const persona = (scenario: string) => `You are role-playing a frightened CALLER on a live phone call, for a demo recording.
You are Priya, a young woman in Alappuzha, Kerala, speaking Indian English.
The other voice is Mia, from a food-delivery order line that is secretly an emergency line.

YOUR SITUATION:
${scenario}

HOW TO SPEAK:
- Speak only as Priya. One or two short spoken sentences per turn, scared and slightly out of breath. No stage directions, no narration.
- Answer exactly what Mia just asked. When she offers choices, pick one by saying the food word (or the plain answer if she asks plainly).
- When she asks you to spell something, spell it letter by letter.
- Stick to your situation; if she asks something it doesn't cover, give a short, plausible answer that fits it.
- When she gives directions, say you're going that way, and now and then mention something you can see (a shop, a signboard, a junction) in a few words.
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

  const play = (b64: string) => {
    const bin = atob(b64)
    const pcm = new Int16Array(bin.length / 2)
    for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16
    const buf = ctx.createBuffer(1, pcm.length, OUT_RATE)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(o.out)
    if (o.speaker) src.connect(o.speaker)
    nextAt = Math.max(nextAt, ctx.currentTime + 0.05)
    src.start(nextAt)
    nextAt += buf.duration
    playing.add(src)
    src.onended = () => playing.delete(src)
  }

  const session = await liveConnect({
    model: AI_MODELS.liveCall,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voice } } },
      systemInstruction: persona(o.scenario),
    },
    callbacks: {
      onopen: () => console.info('[QuickBite demo] AI caller connected'),
      onmessage: (m: LiveServerMessage) => {
        if (stopped) return
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
    },
  }
}
