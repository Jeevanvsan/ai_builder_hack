import { useEffect, useRef, useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import { useVideoViewer } from '../lib/useVideoViewer'

const BAR_COUNT = 24

// A responder can listen live to the caller's raw microphone audio — one-way, never sent back to the caller.
// Muted by default (a responder may be in a shared office); one click unmutes. A live waveform shows whether the
// caller is currently speaking even while muted, so a responder can tell the call is live without turning on sound.
export default function LiveAudioListen({ incident }: { incident: Incident }) {
  const { user, responder } = useAuth()
  const { state, stream, retry } = useVideoViewer(incident.id, incident.audioListen, responderLabel(user, responder), 'mic')
  const audioRef = useRef<HTMLAudioElement>(null)
  const [unmuted, setUnmuted] = useState(false)
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0))
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream
    setUnmuted(false)
  }, [stream])

  // Drives the waveform from the actual incoming audio, whether or not it's currently audible to the responder —
  // an AnalyserNode taps the stream directly, independent of the <audio> element's own muted/volume state.
  useEffect(() => {
    if (!stream || state !== 'live') {
      setLevels(Array(BAR_COUNT).fill(0))
      return
    }
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
      const next: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        const slice = data.slice(i * step, i * step + step)
        const avg = slice.reduce((s, v) => s + v, 0) / (slice.length || 1)
        next.push(Math.min(1, avg / 130))
      }
      setLevels(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      source.disconnect()
      analyser.disconnect()
      void ctx.close().catch(() => {})
    }
  }, [stream, state])

  const speaking = levels.some((l) => l > 0.15)

  return (
    <div className="audio-listen">
      <audio ref={audioRef} autoPlay muted={!unmuted} />
      <div className="audio-listen-head">
        <span className="audio-listen-label">
          {state === 'live' && <span className="live-dot" />}
          Live audio {state === 'live' ? (speaking ? '· caller speaking' : '· quiet') : ''}
        </span>
        {state === 'live' && (
          <button type="button" className={`btn btn-sm${unmuted ? ' active' : ''}`} onClick={() => setUnmuted((u) => !u)}>
            {unmuted ? 'Mute' : 'Listen'}
          </button>
        )}
      </div>
      <div className={`audio-waveform${speaking ? ' is-speaking' : ''}`} aria-hidden="true">
        {levels.map((l, i) => (
          <span key={i} className="audio-bar" style={{ height: `${8 + l * 32}px` }} />
        ))}
      </div>
      {state === 'connecting' && <p className="sub">Connecting to the caller's mic…</p>}
      {state === 'failed' && (
        <p className="sub">
          Couldn't connect to the live audio. <button type="button" className="btn btn-sm" onClick={retry}>Try again</button>
        </p>
      )}
      {state === 'lost' && <p className="sub">Live audio lost — the caller's device stopped responding.</p>}
      {state === 'ended' && <p className="sub">Live audio ended{incident.audioListen?.endedAt ? ` at ${formatTime(incident.audioListen.endedAt)}` : ''}.</p>}
      {state === 'none' && <p className="sub">No live audio for this call.</p>}
    </div>
  )
}
