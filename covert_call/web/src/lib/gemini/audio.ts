// Gemini Live needs raw 16-bit PCM audio at 16kHz for input, and returns 24kHz PCM16 for output — neither
// matches what getUserMedia/AudioContext give natively, so both directions need converting by hand.

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Captures the mic, resamples to 16kHz mono PCM16, and calls `onChunk` with base64-encoded audio ready for
// Session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }).
export async function startMicCapture(onChunk: (base64Pcm: string) => void): Promise<{ stop: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessorNode is deprecated but still the simplest cross-browser way to get raw PCM frames without
  // shipping a separate AudioWorklet module file for a hackathon-scope integration.
  const processor = context.createScriptProcessor(4096, 1, 1)

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const resampled = resampleTo16k(input, context.sampleRate)
    onChunk(arrayBufferToBase64(floatTo16BitPCM(resampled)))
  }

  source.connect(processor)
  processor.connect(context.destination)

  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      processor.disconnect()
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      void context.close()
    },
  }
}

function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === INPUT_SAMPLE_RATE) return input
  const ratio = inputRate / INPUT_SAMPLE_RATE
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) out[i] = input[Math.floor(i * ratio)]
  return out
}

// Plays back base64 PCM16 audio chunks the model sends, in order, as they arrive.
export function createAudioPlayer() {
  const context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
  let nextStartTime = 0
  let closed = false

  function play(base64Pcm: string) {
    if (closed) return
    // Browsers create AudioContext 'suspended' until resumed inside a user-gesture window; by the time this
    // context exists (after several awaited async steps since the click), that window has usually passed, so
    // resume explicitly on the first real audio chunk rather than relying on autoplay working by default.
    if (context.state === 'suspended') void context.resume()

    const binary = atob(base64Pcm)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const pcm16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000

    const buffer = context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE)
    buffer.copyToChannel(float32, 0)

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime, nextStartTime)
    source.start(startAt)
    nextStartTime = startAt + buffer.duration
  }

  function stop() {
    if (closed) return
    closed = true
    nextStartTime = 0
    void context.close()
  }

  return { play, stop }
}
