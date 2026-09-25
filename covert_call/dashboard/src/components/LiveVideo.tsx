import { useEffect, useRef, useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import type { Camera } from '../../../shared/video/signaling'
import { formatTime } from '../lib/format'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import { useVideoViewer } from '../lib/useVideoViewer'

export default function LiveVideo({ incident, large = false }: { incident: Incident; large?: boolean }) {
  const { user, responder } = useAuth()
  // An SOS can carry two feeds (Epic 11). Offer a Back/Front toggle when both exist; default to whichever is there.
  const hasBack = Boolean(incident.video)
  const hasFront = Boolean(incident.videoFront)
  const [picked, setPicked] = useState<Camera>('back')

  // Derive the effective camera during render (no effect): honour the pick, but fall back to whichever feed
  // actually exists so we never point the viewer at an absent feed.
  const camera: Camera = picked === 'front' ? (hasFront ? 'front' : 'back') : hasBack ? 'back' : 'front'

  const feed = camera === 'front' ? incident.videoFront : incident.video
  const { state, stream, retry } = useVideoViewer(incident.id, feed, responderLabel(user, responder), camera)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const label = camera === 'front' ? 'front camera' : 'back camera'

  return (
    <div className={`video-frame${large ? ' video-frame-large' : ''}`}>
      {hasBack && hasFront && (
        <div className="video-cam-toggle">
          <button type="button" className={`btn btn-sm${camera === 'back' ? ' active' : ''}`} onClick={() => setPicked('back')}>Back</button>
          <button type="button" className={`btn btn-sm${camera === 'front' ? ' active' : ''}`} onClick={() => setPicked('front')}>Front</button>
        </div>
      )}
      {/* Muted + playsInline so browsers allow autoplay; the feed carries no audio anyway. */}
      <video ref={videoRef} className="video-el" autoPlay muted playsInline hidden={state !== 'live'} />
      {state === 'live' && <span className="video-badge"><span className="live-dot" />Live · {label}</span>}
      {state === 'connecting' && <div className="video-overlay">Connecting to the caller's {label}…</div>}
      {state === 'failed' && (
        <div className="video-overlay">
          <span>Couldn't connect to the {label} feed.</span>
          <span className="sub">The caller's network may block direct video.</span>
          <button type="button" className="btn btn-sm" onClick={retry}>Try again</button>
        </div>
      )}
      {state === 'lost' && (
        <div className="video-overlay">
          <span>{label} feed lost.</span>
          <span className="sub">The caller's device stopped responding. It reconnects automatically if the feed resumes.</span>
        </div>
      )}
      {state === 'ended' && (
        <div className="video-overlay">
          {label} feed ended{feed?.endedAt ? ` at ${formatTime(feed.endedAt)}` : ''}.
        </div>
      )}
    </div>
  )
}
