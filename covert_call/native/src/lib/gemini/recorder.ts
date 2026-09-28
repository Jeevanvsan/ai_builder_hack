import { bytesToBase64 } from '../platform/audio'

// Native equivalent of web/src/lib/gemini/recorder.ts.
//
// The web mixes the caller's mic and the AI's replies into one MediaRecorder input through a Web Audio graph and
// gets compact Opus out. React Native has neither, so the mixing happens here in JS and the result is written as
// a WAV file. The point is the same: one file a responder can play start to finish, not two they have to sync.
//
// WAV is uncompressed, which is the honest trade-off of having no encoder available:
//   ~1.9 MB per minute at 16 kHz mono.
// That is fine for Drive (see drive.ts) but blows past the ~1 MB Firestore fallback after roughly 30 seconds, so
// on native the fallback realistically only covers very short calls. A failed save is surfaced on the incident
// rather than silently dropped, exactly as on the web.

const RATE = 16_000
// Hard cap so a forgotten-about session can't grow the buffer without bound on a low-end phone. At 2 bytes per
// sample this is ~19 MB of RAM for the recording itself.
const MAX_SECONDS = 10 * 60

export type CallRecorder = {
  // The caller's mic, already at 16 kHz. This is the continuous stream, so it defines the timeline.
  addMic: (pcm: Float32Array) => void
  // Mia's replies, at whatever rate the player received them; mixed in at "now" on the mic's timeline.
  addAi: (pcm: Float32Array, sampleRate: number) => void
  stop: () => { base64: string; mimeType: string } | null
}

const clampToInt16 = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v)

export function startCallRecording(): CallRecorder {
  let buffer = new Int16Array(RATE * 60)
  // How far the mic has written. Doubles as the playhead for mixing in Mia's audio.
  let micPos = 0
  // The furthest any source has written, which is what actually gets encoded (Mia can be ahead of the mic).
  let filled = 0
  let stopped = false

  const ensure = (needed: number): boolean => {
    if (needed > RATE * MAX_SECONDS) return false
    if (needed <= buffer.length) return true
    let next = buffer.length
    while (next < needed) next *= 2
    const grown = new Int16Array(Math.min(next, RATE * MAX_SECONDS))
    grown.set(buffer)
    buffer = grown
    return true
  }

  // Mixes `pcm` into the buffer at `offset`, adding rather than overwriting so mic and AI can overlap.
  const mixInto = (pcm: Float32Array, offset: number) => {
    if (!ensure(offset + pcm.length)) return
    for (let i = 0; i < pcm.length; i++) {
      const s = pcm[i]
      const sample = s < 0 ? s * 0x8000 : s * 0x7fff
      buffer[offset + i] = clampToInt16(buffer[offset + i] + sample)
    }
    if (offset + pcm.length > filled) filled = offset + pcm.length
  }

  const resampleTo16k = (pcm: Float32Array, rate: number): Float32Array => {
    if (rate === RATE) return pcm
    const ratio = rate / RATE
    const out = new Float32Array(Math.floor(pcm.length / ratio))
    for (let i = 0; i < out.length; i++) out[i] = pcm[Math.floor(i * ratio)]
    return out
  }

  return {
    addMic(pcm) {
      if (stopped) return
      mixInto(pcm, micPos)
      micPos += pcm.length
    },

    addAi(pcm, sampleRate) {
      if (stopped) return
      // Placed at the mic's current position, i.e. roughly when the caller would have heard it. Good enough for
      // evidence: the two sides line up to within one mic chunk (~100 ms).
      mixInto(resampleTo16k(pcm, sampleRate), micPos)
    },

    stop() {
      if (stopped) return null
      stopped = true
      if (filled === 0) return null
      return { base64: bytesToBase64(encodeWav(buffer.subarray(0, filled), RATE)), mimeType: 'audio/wav' }
    },
  }
}

// Minimal 16-bit mono PCM WAV container (44-byte header + samples).
function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2
  const out = new Uint8Array(44 + dataBytes)
  const view = new DataView(out.buffer)

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // format: PCM
  view.setUint16(22, 1, true) // channels: mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true)
  return out
}
