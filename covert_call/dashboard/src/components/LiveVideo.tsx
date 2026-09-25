import { useEffect, useRef } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import { useVideoViewer } from '../lib/useVideoViewer'

export default function LiveVideo({ incident, large = false }: { incident: Incident; large?: boolean }) {
  const { user, responder } = useAuth()
  const { state, stream, retry } = useVideoViewer(incident.id, incident.video, responderLabel(user, responder))
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div className={`video-frame${large ? ' video-frame-large' : ''}`}>
      {/* Muted + playsInline so browsers allow autoplay; the feed carries no audio anyway. */}
      <video ref={videoRef} className="video-el" autoPlay muted playsInline hidden={state !== 'live'} />
      {state === 'live' && <span className="video-badge"><span className="live-dot" />Live · back camera</span>}
      {state === 'connecting' && <div className="video-overlay">Connecting to the caller's camera…</div>}
      {state === 'failed' && (
        <div className="video-overlay">
          <span>Couldn't connect to the camera feed.</span>
          <span className="sub">The caller's network may block direct video.</span>
          <button type="button" className="btn btn-sm" onClick={retry}>Try again</button>
        </div>
      )}
      {state === 'lost' && (
        <div className="video-overlay">
          <span>Camera feed lost.</span>
          <span className="sub">The caller's device stopped responding. It reconnects automatically if the feed resumes.</span>
        </div>
      )}
      {state === 'ended' && (
        <div className="video-overlay">
          Camera feed ended{incident.video?.endedAt ? ` at ${formatTime(incident.video.endedAt)}` : ''}.
        </div>
      )}
    </div>
  )
}
