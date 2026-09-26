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

// Phone browsers play Web Audio through the loudspeaker (a web page can't pick the earpiece), so echo
// cancellation matters: without it Mia hears her own voice back through the mic. Shared so the caller can request
// the mic and the back camera in one getUserMedia (Epic 9) with the identical audio constraints.
export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

// Captures the mic, resamples to 16kHz mono PCM16, and calls `onChunk` with base64-encoded audio ready for
// Session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }).
// If `providedStream` is passed (e.g. the caller already opened the mic alongside the camera), its audio track is
// reused and its tracks are left for the caller to stop; otherwise the mic is opened and owned here.
export async function startMicCapture(
  onChunk: (base64Pcm: string) => void,
  providedStream?: MediaStream,
): Promise<{ stop: () => void; stream: MediaStream }> {
  const ownsStream = !providedStream
  const stream = providedStream ?? (await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS }))
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessorNode is deprecated but still the simplest cross-browser way to get raw PCM frames without
  // shipping a separate AudioWorklet module file for a hackathon-scope integration.
  const processor = context.createScriptProcessor(4096, 1, 1)
  // A silent gain node, not context.destination — ScriptProcessorNode needs to be connected to something to
  // fire onaudioprocess in some browsers, but connecting straight to the speakers would echo the caller's own
  // voice back to them.
  const silentSink = context.createGain()
  silentSink.gain.value = 0

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const resampled = resampleTo16k(input, context.sampleRate)
    onChunk(arrayBufferToBase64(floatTo16BitPCM(resampled)))
  }

  source.connect(processor)
  processor.connect(silentSink)
  silentSink.connect(context.destination)

  let stopped = false
  return {
    stream,
    stop: () => {
      if (stopped) return
      stopped = true
      processor.disconnect()
      source.disconnect()
      // Only stop the mic if we opened it. A caller-provided stream (shared with the camera/recorder) is stopped
      // by the caller once everything that uses it has finished.
      if (ownsStream) stream.getTracks().forEach((t) => t.stop())
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

// Plays back base64 PCM16 audio chunks the model sends, in order, as they arrive. Also exposes the same audio
// as a MediaStream (`recordingStream`) so the call recorder can mix it with the caller's mic without needing a
// second decode of the same data.
export function createAudioPlayer() {
  const context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
  const recordingDestination = context.createMediaStreamDestination()
  let nextStartTime = 0
  let closed = false
  let activeSources: AudioBufferSourceNode[] = []

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
    source.connect(recordingDestination)
    // If real time has already caught up to (or passed) the scheduled queue — e.g. after a pause between
    // chunks — start immediately instead of scheduling in the past, which some browsers silently drop.
    const startAt = Math.max(context.currentTime, nextStartTime)
    source.start(startAt)
    nextStartTime = startAt + buffer.duration
    activeSources.push(source)
    source.onended = () => { activeSources = activeSources.filter((s) => s !== source) }
  }

  // Barge-in: the model sends `interrupted: true` whenever the caller's voice cuts across its own speech — this
  // is normal mid-conversation, not the end of the call. Only the currently-queued audio should stop; the
  // context itself must stay open so the model's next turn can still be heard.
  function clearQueue() {
    for (const source of activeSources) {
      try { source.stop() } catch { /* already finished */ }
    }
    activeSources = []
    nextStartTime = context.currentTime
  }

  function stop() {
    if (closed) return
    closed = true
    nextStartTime = 0
    void context.close()
  }

  const isPlaying = () => !closed && nextStartTime > context.currentTime

  return { play, stop, clearQueue, isPlaying, recordingStream: recordingDestination.stream }
}
