import { AudioContext, AudioRecorder, AudioManager } from 'react-native-audio-api'
import * as TwoWay from '@speechmatics/expo-two-way-audio'
import { AUDIO_BACKEND } from '../config'

// Native port of web/src/lib/gemini/audio.ts — keep the two in sync.
//
// Gemini Live wants raw 16 kHz mono PCM16 in, and returns 24 kHz PCM16 out. Neither the web nor React Native
// gives you those rates natively, so both directions are converted by hand. The conversion maths below is
// copied from the web file unchanged; only the capture and playback plumbing differs.
//
// Two backends ship in the same build and are chosen by AUDIO_BACKEND in config.ts (see the note there on the
// echo-cancellation vs. background-evidence trade-off). Both satisfy the same MicHandle / Player interfaces, so
// nothing above this file knows which one is running.

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000
// 100 ms of audio per callback: small enough that Gemini's voice-activity detection stays responsive, large
// enough that the bridge isn't crossed hundreds of times a second.
const MIC_BUFFER_SAMPLES = 1_600

// ---------------------------------------------------------------------------------------------------------
// Pure conversion helpers (same maths as the web's audio.ts)
// ---------------------------------------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Hermes has btoa, but it takes a binary *string*, so using it means building a multi-megabyte intermediate
// string per call via String.fromCharCode. Encoding the bytes directly is both faster and avoids the argument
// -count limits that bite on large frames.
function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '=='
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '='
  }
  return out
}

const B64_LOOKUP = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i
  return t
})()

function base64ToBytes(base64: string): Uint8Array {
  let len = base64.length
  while (len > 0 && base64[len - 1] === '=') len--
  const byteLength = (len * 3) >> 2
  const out = new Uint8Array(byteLength)
  let o = 0
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[base64.charCodeAt(i)]
    const b = B64_LOOKUP[base64.charCodeAt(i + 1)]
    const c = B64_LOOKUP[base64.charCodeAt(i + 2)]
    const d = B64_LOOKUP[base64.charCodeAt(i + 3)]
    if (o < byteLength) out[o++] = (a << 2) | (b >> 4)
    if (o < byteLength) out[o++] = ((b & 15) << 4) | (c >> 2)
    if (o < byteLength) out[o++] = ((c & 3) << 6) | d
  }
  return out
}

function floatTo16BitPCM(input: Float32Array): Uint8Array {
  const out = new Uint8Array(input.length * 2)
  const view = new DataView(out.buffer)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return out
}

function resample(input: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (inputRate === targetRate) return input
  const ratio = inputRate / targetRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) out[i] = input[Math.floor(i * ratio)]
  return out
}

function rms(input: Float32Array): number {
  let sum = 0
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
  return Math.sqrt(sum / input.length)
}

// PCM16 bytes -> Float32, used for both playback decoding and the two-way backend's level metering.
function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float32Array(bytes.byteLength >> 1)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000
  return out
}

// ---------------------------------------------------------------------------------------------------------
// Microphone
// ---------------------------------------------------------------------------------------------------------

export type MicHandle = { stop: () => void }

// Captures the mic and calls `onChunk` with base64 16 kHz mono PCM16, ready for
// session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }), plus an RMS level so the
// call can tell the caller is talking before any transcript arrives (the web uses this for its silence
// watchdog, and the SOS uses it to log — never to act on — a silent room).
export async function startMicCapture(onChunk: (base64Pcm: string, level: number) => void): Promise<MicHandle> {
  if (AUDIO_BACKEND === 'two-way') return startMicTwoWay(onChunk)
  return startMicAudioApi(onChunk)
}

async function startMicAudioApi(onChunk: (base64Pcm: string, level: number) => void): Promise<MicHandle> {
  const permission = await AudioManager.requestRecordingPermissions()
  if (permission !== 'Granted') throw new Error('Microphone permission denied')

  const recorder = new AudioRecorder({
    sampleRate: INPUT_SAMPLE_RATE,
    bufferLengthInSamples: MIC_BUFFER_SAMPLES,
  })

  // Straggler frames can still arrive right after stop() — the same guard the web keeps inside its
  // onaudioprocess handler, for the same reason: without it those frames reach a Gemini socket that has already
  // been closed, producing a flood of "WebSocket is already in CLOSING or CLOSED state".
  let stopped = false

  recorder.onAudioReady(({ buffer }) => {
    if (stopped) return
    const channel = buffer.getChannelData(0)
    // The recorder is asked for 16 kHz and Android resamples to it, but the delivered buffer reports its own
    // rate — resample from whatever actually arrived rather than assuming the request was honoured.
    const resampled = resample(channel, buffer.sampleRate, INPUT_SAMPLE_RATE)
    onChunk(bytesToBase64(floatTo16BitPCM(resampled)), rms(channel))
  })

  recorder.start()

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        recorder.stop()
      } catch {
        // Already stopped or torn down by the OS — nothing left to release.
      }
    },
  }
}

async function startMicTwoWay(onChunk: (base64Pcm: string, level: number) => void): Promise<MicHandle> {
  const permission = await TwoWay.requestMicrophonePermissionsAsync()
  if (!permission.granted) throw new Error('Microphone permission denied')

  await TwoWay.initialize()

  let stopped = false
  // This backend already delivers exactly what Gemini wants: 16 kHz mono PCM16, captured through the phone's
  // voice-communication path, so there is nothing to resample.
  const subscription = TwoWay.addExpoTwoWayAudioEventListener('onMicrophoneData', (event) => {
    if (stopped) return
    const bytes = event.data
    onChunk(bytesToBase64(bytes), rms(pcm16ToFloat32(bytes)))
  })

  TwoWay.toggleRecording(true)

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        TwoWay.toggleRecording(false)
        subscription?.remove?.()
      } catch {
        // Already torn down.
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------------------------------------

export type Player = {
  play: (base64Pcm: string) => void
  // Barge-in: drop what is queued but keep the output alive for the model's next turn.
  clearQueue: () => void
  stop: () => void
  isPlaying: () => boolean
  // Lets the call recorder capture Mia's side of the conversation. The web instead taps a MediaStream from the
  // Web Audio graph; React Native has no equivalent, so the PCM is handed over as it is played.
  onPcm: (listener: ((pcm: Float32Array, sampleRate: number) => void) | null) => void
}

export function createAudioPlayer(): Player {
  if (AUDIO_BACKEND === 'two-way') return createTwoWayPlayer()
  return createAudioApiPlayer()
}

function createAudioApiPlayer(): Player {
  const context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
  let nextStartTime = 0
  let closed = false
  let sources: { stop: (when?: number) => void }[] = []
  let pcmListener: ((pcm: Float32Array, sampleRate: number) => void) | null = null

  return {
    play(base64Pcm) {
      if (closed) return
      const float32 = pcm16ToFloat32(base64ToBytes(base64Pcm))
      if (!float32.length) return
      pcmListener?.(float32, OUTPUT_SAMPLE_RATE)

      const buffer = context.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE)
      buffer.copyToChannel(float32, 0)

      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      // If real time has already caught up to the queue — a pause between chunks — start now rather than
      // scheduling in the past, which is silently dropped.
      const startAt = Math.max(context.currentTime, nextStartTime)
      source.start(startAt)
      nextStartTime = startAt + buffer.duration
      sources.push(source)
      source.onEnded = () => {
        sources = sources.filter((s) => s !== source)
      }
    },

    clearQueue() {
      for (const source of sources) {
        try {
          source.stop()
        } catch {
          // Already finished.
        }
      }
      sources = []
      nextStartTime = context.currentTime
    },

    stop() {
      if (closed) return
      closed = true
      nextStartTime = 0
      void context.close()
    },

    isPlaying: () => !closed && nextStartTime > context.currentTime,

    onPcm: (listener) => {
      pcmListener = listener
    },
  }
}

function createTwoWayPlayer(): Player {
  // This backend's output runs at 16 kHz, so Gemini's 24 kHz has to come down to meet it.
  const PLAYBACK_RATE = 16_000
  let closed = false
  // It exposes no scheduling clock, so "still playing" is tracked from how much audio has been handed over.
  let playingUntil = 0
  let pcmListener: ((pcm: Float32Array, sampleRate: number) => void) | null = null

  return {
    play(base64Pcm) {
      if (closed) return
      const float32 = pcm16ToFloat32(base64ToBytes(base64Pcm))
      if (!float32.length) return
      pcmListener?.(float32, OUTPUT_SAMPLE_RATE)

      const downsampled = resample(float32, OUTPUT_SAMPLE_RATE, PLAYBACK_RATE)
      TwoWay.playPCMData(floatTo16BitPCM(downsampled))

      const now = Date.now()
      const durationMs = (downsampled.length / PLAYBACK_RATE) * 1000
      playingUntil = Math.max(now, playingUntil) + durationMs
    },

    clearQueue() {
      // No queue-drop API is exposed, so a barge-in can't cut audio already handed to the engine. Reset the
      // clock so the call's silence watchdog doesn't keep treating the session as busy speaking.
      playingUntil = 0
    },

    stop() {
      if (closed) return
      closed = true
      playingUntil = 0
      try {
        TwoWay.tearDown()
      } catch {
        // Already torn down.
      }
    },

    isPlaying: () => !closed && Date.now() < playingUntil,

    onPcm: (listener) => {
      pcmListener = listener
    },
  }
}
