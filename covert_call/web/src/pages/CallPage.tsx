import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useCart } from '../state/cart'
import { INCIDENTS, startIncident, recordLeakageCheck, consolidateIncident, recordGroundedContext, recordCorrelatedIncidents, markHasRecording, upsertVideoRecording, setAudioRecording } from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types.ts'
import { startVideoPublisher } from '../../../shared/video/publisher.ts'
import { db } from '../lib/firebase'
import { APP_NAME } from '../lib/brand'
import { consolidateCall } from '../lib/gemini/consolidate'
import { groundedLocationContext } from '../lib/gemini/groundedContext'
import { findCorrelatedIncidents } from '../lib/gemini/correlate'
import { zeroTraceExit } from '../lib/gemini/exit'
import { startLiveCall, type CallStatus, type LiveCallHandle } from '../lib/gemini/liveSession'
import { saveCallRecording } from '../lib/gemini/uploadRecording'
import { acquireCallMedia, videoOnly } from '../lib/gemini/media'
import { startVideoRecording, type VideoRecorderHandle } from '../lib/gemini/videoRecorder'
import { driveConfigured, uploadCallVideo } from '../lib/gemini/videoUpload'
import { MicIcon, MicOffIcon, PhoneIcon, SpeakerIcon } from '../components/disguise/icons'

const STATUS_LABEL: Record<CallStatus, string> = {
  connecting: 'Connecting…',
  live: 'Connected',
  ended: 'Call ended',
  failed: "Couldn't connect",
}

export function CallPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const [status, setStatus] = useState<CallStatus>('connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const incidentIdRef = useRef<string | null>(null)
  const callRef = useRef<LiveCallHandle | null>(null)
  // Back-camera video (Epic 9): the shared mic+camera stream, the live-feed publisher's stop fn, and the Drive
  // recorder handle. All optional — the call runs audio-only if there's no camera.
  const mediaRef = useRef<MediaStream | null>(null)
  const publisherStopRef = useRef<(() => Promise<void>) | null>(null)
  const videoRecRef = useRef<VideoRecorderHandle | null>(null)
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Cart state at the moment this page mounted — later cart changes (e.g. adding items in another tab) must not
  // retrigger the call setup, only the render-time redirect below reacts to those.
  const cartHadItemsOnMount = useRef(cart.count > 0)
  const startedRef = useRef(false)
  // finishCall is called from two places (the End button, and the model's end_call tool call once the caller
  // confirms or after 3 silent retries) — guard so whichever fires first wins and the other is a no-op.
  const endingRef = useRef(false)
  const finishCallRef = useRef<() => void>(() => {})

  useEffect(() => {
    // startedRef makes this a true one-shot for the component's whole lifetime, including across React
    // StrictMode's dev-only mount -> cleanup -> re-mount cycle: without it, that cycle either starts two calls,
    // or — since the cleanup below would otherwise fire on the throwaway first mount before the async call setup
    // even finishes — tears down the one real call almost immediately after it connects. There is deliberately
    // no unmount cleanup here beyond this guard: the call's real end-of-life path is the End button
    // (finishCall) or the browser tab closing (which the OS cleans up regardless).
    if (cartHadItemsOnMount.current || startedRef.current) return
    startedRef.current = true

    void (async () => {
      const { id } = await startIncident(db, { channel: 'live-call' })
      incidentIdRef.current = id

      // Open the mic and the back camera together (falls back to audio-only if there's no camera).
      const media = await acquireCallMedia()
      mediaRef.current = media?.stream ?? null

      try {
        const handle = await startLiveCall(
          db,
          id,
          { onStatusChange: setStatus, onCallEnd: () => finishCallRef.current() },
          {
            micStream: media ? new MediaStream(media.stream.getAudioTracks()) : undefined,
            videoStream: media?.hasVideo ? videoOnly(media.stream) : undefined,
          },
        )
        callRef.current = handle
      } catch {
        setStatus('failed')
      }

      // With a camera: stream it live to the dashboard, and (if Drive is configured) record video + audio for the
      // team's Drive archive. Both are best-effort and never block the call.
      if (media?.hasVideo && mediaRef.current) {
        try {
          publisherStopRef.current = await startVideoPublisher(db, id, videoOnly(mediaRef.current))
        } catch {
          // A blocked WebRTC connection just means no live feed; the call and recording continue.
        }
        if (driveConfigured) {
          const rec = startVideoRecording(mediaRef.current)
          if (rec) {
            videoRecRef.current = rec
            void upsertVideoRecording(db, id, { camera: 'back', status: 'recording', startedAt: new Date().toISOString() })
            // Periodically upload the recording-so-far (overwrites by filename) so a tab killed mid-call still
            // leaves footage in Drive (Epic 9.2).
            snapshotTimerRef.current = setInterval(() => {
              const blob = rec.snapshot()
              if (blob) void uploadCallVideo(blob, { incidentId: id, camera: 'back', mimeType: rec.mimeType }).catch(() => {})
            }, 20_000)
          }
        }
      }
    })()
  }, [])

  useEffect(() => {
    if (status !== 'live') return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [status])

  const finishCall = async () => {
    if (endingRef.current) return
    endingRef.current = true
    const id = incidentIdRef.current
    const call = callRef.current
    const transcript = call?.getTranscript() ?? ''

    // Stop periodic snapshot uploads, then stop the recorder while the camera is still live for the final chunk.
    if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current)
    const videoBlob = videoRecRef.current ? await videoRecRef.current.stop() : null
    const videoMime = videoRecRef.current?.mimeType ?? 'video/webm'

    const recording = await call?.end()
    // Stop the live feed (also marks video ended on the incident) and release the camera + mic.
    await publisherStopRef.current?.()
    mediaRef.current?.getTracks().forEach((t) => t.stop())
    setStatus('ended')

    if (id) {
      try {
        const snap = await getDoc(doc(db, INCIDENTS, id))
        const incident = snap.data() as Omit<Incident, 'id'> | undefined
        const fields = incident?.extractedFieldsLive ?? { peopleCount: null, dangerIndicators: [], urgency: null, notes: null }
        const stressTrend = incident?.voiceStressTrend ?? []
        const address = incident?.location.confirmed?.address ?? null

        // Retry once on failure (a transient network blip or rate limit shouldn't permanently lose the case
        // summary) before giving up and flagging it for the dashboard. One request now covers both the case
        // summary/bulletin and the privacy (leakage) check — was two separate model calls on the same
        // transcript, which needlessly doubled how often a single call could hit the shared free-tier rate limit.
        const withRetry = <T,>(fn: () => Promise<T>) => fn().catch(() => fn())
        try {
          const consolidation = await withRetry(() => consolidateCall(transcript, fields, stressTrend, address))
          await Promise.all([
            consolidateIncident(db, id, consolidation),
            recordLeakageCheck(db, id, consolidation.redactions),
          ])
        } catch (e) {
          console.error('[QuickBite call] consolidation failed after retry:', e)
          await updateDoc(doc(db, INCIDENTS, id), { consolidationFailed: true }).catch(() => {})
        }

        if (address) {
          void groundedLocationContext(address).then((context) => {
            if (context) void recordGroundedContext(db, id, context)
          })
        }

        if (incident) {
          void findCorrelatedIncidents(db, { ...incident, id }).then((matchIds) => {
            if (matchIds.length) void recordCorrelatedIncidents(db, id, matchIds)
          })
        }
      } catch {
        // Best-effort: the incident's live-extracted fields are already saved even if consolidation/leakage
        // check fails here (e.g. no key configured) — a responder still sees everything gathered during the call.
      }

      if (recording) {
        // Drive first (no size cap, unlike the Firestore fallback below) when configured — same uploader as the
        // call video. Uploaded in the background so ending the call stays instant; falls back to the Firestore
        // subcollection doc only if Drive isn't configured or its upload fails.
        if (driveConfigured) {
          void updateDoc(doc(db, INCIDENTS, id), {
            audioRecording: { status: 'recording', startedAt: new Date().toISOString() },
          }).catch(() => {})
          void (async () => {
            try {
              const result = await uploadCallVideo(recording, { incidentId: id, camera: 'back', mimeType: recording.type || 'audio/webm' })
              await setAudioRecording(db, id, {
                status: 'uploaded',
                driveFileId: result?.driveFileId ?? null,
                driveUrl: result?.driveUrl ?? null,
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
              })
            } catch (e) {
              console.error('[QuickBite call] Drive audio upload failed, falling back to Firestore:', e)
              await setAudioRecording(db, id, { status: 'failed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString() }).catch(() => {})
              try {
                await saveCallRecording(id, recording)
                await markHasRecording(db, id)
              } catch (e2) {
                console.error('[QuickBite call] Firestore fallback also failed:', e2)
                await updateDoc(doc(db, INCIDENTS, id), { recordingFailed: e2 instanceof Error ? e2.message.slice(0, 200) : 'Unknown error' }).catch(() => {})
              }
            }
          })()
        } else {
          try {
            await saveCallRecording(id, recording)
            await markHasRecording(db, id)
          } catch (e) {
            // Best-effort: losing the recording (e.g. a long call too big for one Firestore document) shouldn't
            // block ending the call — every other piece of the incident (fields, summary, location) is still saved.
            // But it's flagged (not silently dropped) so the dashboard can say why there's no player.
            console.error('[QuickBite call] saving the recording failed:', e)
            await updateDoc(doc(db, INCIDENTS, id), { recordingFailed: e instanceof Error ? e.message.slice(0, 200) : 'Unknown error' }).catch(() => {})
          }
        }
      }

      // Upload the Drive video in the background so the exit stays instant. The videoRecording entry flips from
      // "recording" to "uploaded" (or "failed") once the upload settles; navigating away doesn't cancel the fetch.
      if (videoBlob) {
        void (async () => {
          try {
            const result = await uploadCallVideo(videoBlob, { incidentId: id, camera: 'back', mimeType: videoMime })
            await upsertVideoRecording(db, id, {
              camera: 'back',
              status: 'uploaded',
              driveFileId: result?.driveFileId ?? null,
              driveUrl: result?.driveUrl ?? null,
              endedAt: new Date().toISOString(),
            })
          } catch {
            await upsertVideoRecording(db, id, { camera: 'back', status: 'failed', endedAt: new Date().toISOString() }).catch(() => {})
          }
        })()
      }

      zeroTraceExit(db, id, navigate)
    } else {
      navigate('/', { replace: true })
    }
  }

  useEffect(() => {
    finishCallRef.current = () => void finishCall()
  })

  const toggleMute = () => {
    const nowMuted = callRef.current?.toggleMute() ?? !muted
    setMuted(nowMuted)
  }

  if (cart.count > 0) return <Navigate to="/cart" replace />

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <div className="page call-page">
      <div className="call-top">
        <div className="call-avatar" aria-hidden="true">QB</div>
        <h1>{APP_NAME} Order Desk</h1>
        <p className="call-status">
          {status === 'live' ? `${minutes}:${secs}` : STATUS_LABEL[status]}
        </p>
        {status === 'failed' && (
          <Link to="/" className="link-btn" replace>
            Back to menu
          </Link>
        )}
      </div>
      <div className="call-controls">
        <button
          type="button"
          className={`call-btn${muted ? ' active' : ''}`}
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
          disabled={status !== 'live'}
        >
          {muted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
        </button>
        <button type="button" className="call-btn end" aria-label="End call" onClick={() => void finishCall()}>
          <PhoneIcon size={24} />
        </button>
        <button type="button" className="call-btn" aria-label="Speaker">
          <SpeakerIcon size={22} />
        </button>
      </div>
    </div>
  )
}
