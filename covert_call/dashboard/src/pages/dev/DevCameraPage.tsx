import { useEffect, useRef, useState } from 'react'
import { startVideoPublisher } from '../../../../shared/video/publisher.ts'
import { db } from '../../lib/firebase'
import { useIncidents } from '../../lib/incidentsStore'

// Developer test tool, not part of the responder UI and not linked anywhere: streams this device's camera into
// an incident using the same shared publisher the QuickBite app will call, so the dashboard's video viewer can be
// tested before the real sender (Person A's native app, back camera) exists. The real sender shows no preview.
export default function DevCameraPage() {
  const { data: incidents } = useIncidents('open')
  const [incidentId, setIncidentId] = useState('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'streaming' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const stopRef = useRef<(() => Promise<void>) | null>(null)
  const previewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream
  }, [stream])

  // Stop the feed when this page unmounts or the tab closes, so dashboards see it end rather than go silent.
  useEffect(() => {
    const onHide = () => void stopRef.current?.()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void stopRef.current?.()
    }
  }, [])

  const start = async () => {
    setStatus('starting')
    setError(null)
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      stopRef.current = await startVideoPublisher(db, incidentId, media)
      setStream(media)
      setStatus('streaming')
    } catch (e) {
      setStatus('error')
      setError((e as Error).message)
    }
  }

  const stop = async () => {
    await stopRef.current?.()
    stopRef.current = null
    setStream(null)
    setStatus('idle')
  }

  return (
    <main className="dev-page">
      <p className="dev-banner">
        Developer test tool. Stands in for the QuickBite app's back camera so the dashboard video can be tested.
        Not part of the responder dashboard.
      </p>
      <h1>Dev camera</h1>
      <label className="field-label" htmlFor="dev-incident">Stream into incident</label>
      <select
        id="dev-incident"
        className="input"
        value={incidentId}
        disabled={status === 'streaming' || status === 'starting'}
        onChange={(e) => setIncidentId(e.target.value)}
      >
        <option value="">Choose an open incident…</option>
        {incidents.map((i) => (
          <option key={i.id} value={i.id}>
            {i.id} · {i.severity} · {i.callState === 'active' ? 'live call' : 'call ended'}
          </option>
        ))}
      </select>
      <div className="dev-actions">
        {status === 'streaming' ? (
          <button type="button" className="btn" onClick={stop}>Stop streaming</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!incidentId || status === 'starting'} onClick={start}>
            {status === 'starting' ? 'Starting…' : 'Start camera'}
          </button>
        )}
        {status === 'streaming' && (
          <a className="btn" href={`/incident/${incidentId}`} target="_blank" rel="noreferrer">Open in dashboard</a>
        )}
      </div>
      {error && <p className="action-error">Couldn't start the camera: {error}</p>}
      <video ref={previewRef} className="dev-preview" autoPlay muted playsInline hidden={!stream} />
    </main>
  )
}
