import { useEffect, useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import type { Incident } from '../../../shared/incidents/types'
import type { Camera } from '../../../shared/video/signaling'
import { INCIDENTS } from '../../../shared/incidents/client'
import { db } from '../lib/firebase'
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

  // Most phones refuse to run both cameras at once, so a session usually carries a single feed and the toggle
  // above has nothing to switch between. In that case the caller's device can be asked to flip the camera it is
  // already streaming. It's a request, not a command: the phone does the switching, and an older app build (or a
  // device that can't flip) simply carries on unchanged, so don't present this as a guarantee.
  const oneFeedOnly = (hasBack || hasFront) && !(hasBack && hasFront)
  const liveNow = state === 'live' || state === 'connecting'
  const [asking, setAsking] = useState(false)
  const [asked, setAsked] = useState<'back' | 'front'>(hasFront && !hasBack ? 'front' : 'back')
  const [flipError, setFlipError] = useState<string | null>(null)

  const requestFlip = async () => {
    if (asking) return
    const next = asked === 'back' ? 'front' : 'back'
    setAsking(true)
    setFlipError(null)
    try {
      // requestedAt is what the phone watches: a fresh timestamp is what tells it this is a new request rather
      // than the value it has already acted on.
      await updateDoc(doc(db, INCIDENTS, incident.id), {
        videoControl: { facing: next, requestedAt: new Date().toISOString() },
      })
      setAsked(next)
    } catch (e) {
      // This was silently swallowed at first, which made a rejected write look exactly like a phone that had
      // ignored the request — the field wasn't permitted by the security rules and nothing said so. Surface it.
      console.error('[dashboard] camera flip request failed:', e)
      setFlipError("Couldn't send the request")
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className={`video-frame${large ? ' video-frame-large' : ''}`}>
      {hasBack && hasFront && (
        <div className="video-cam-toggle">
          <button type="button" className={`btn btn-sm${camera === 'back' ? ' active' : ''}`} onClick={() => setPicked('back')}>Back</button>
          <button type="button" className={`btn btn-sm${camera === 'front' ? ' active' : ''}`} onClick={() => setPicked('front')}>Front</button>
        </div>
      )}
      {oneFeedOnly && liveNow && (
        <div className="video-cam-toggle">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void requestFlip()}
            disabled={asking}
            title="Asks the caller's phone to switch between its front and back camera"
          >
            {asking ? 'Asking…' : `Flip to ${asked === 'back' ? 'front' : 'back'}`}
          </button>
          {flipError && <span className="sub">{flipError}</span>}
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
