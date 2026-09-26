import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import {
  startIncident,
  setCameraMode,
  upsertVideoRecording,
  consolidateIncident,
  recordLeakageCheck,
  recordGroundedContext,
  INCIDENTS,
} from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types.ts'
import { doc, getDoc } from 'firebase/firestore'
import { startVideoPublisher } from '../../../shared/video/publisher.ts'
import { acquireSosMedia, videoOnly } from '../lib/gemini/media'
import { startSilentObserver, type SilentObserverHandle } from '../lib/gemini/silentSession'
import { startVideoRecording, type VideoRecorderHandle } from '../lib/gemini/videoRecorder'
import { driveConfigured, uploadCallVideo } from '../lib/gemini/videoUpload'
import { consolidateCall } from '../lib/gemini/consolidate'
import { groundedLocationContext } from '../lib/gemini/groundedContext'
import { runLeakageCheck } from '../lib/gemini/leakageCheck'
import { zeroTraceExit } from '../lib/gemini/exit'

// The silent SOS screen (Epic 11). Reached ONLY by double-tapping the heart on the home screen. It shows a
// full-black "the phone is off" overlay while it silently records both cameras + the mic, streams the back camera
// to the dashboard, and lets a silent Gemini observer build the incident. The person leaves with a secret gesture:
// three taps in the top-left corner.
export function SosPage() {
  const navigate = useNavigate()
  const startedRef = useRef(false)
  const endingRef = useRef(false)

  const incidentIdRef = useRef<string | null>(null)
  const observerRef = useRef<SilentObserverHandle | null>(null)
  const publisherStopsRef = useRef<(() => Promise<void>)[]>([])
  const recordersRef = useRef<{ facing: 'back' | 'front'; rec: VideoRecorderHandle }[]>([])
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  // Secret exit: three taps in the top-left corner within 1.5s.
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      // An SOS starts at high severity immediately, before anything is known.
      const { id } = await startIncident(db, {
        channel: 'silent-sos',
        incidentType: 'sos',
        scenario: 'hostage',
        severity: 'high',
      })
      incidentIdRef.current = id

      // Keep the screen awake so the OS doesn't lock and pause the camera/mic. Best-effort.
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (wl) wakeLockRef.current = await wl.request('screen')
      } catch {
        // No wake lock — the overlay still hides the screen; the OS may lock after its timeout.
      }

      const media = await acquireSosMedia()
      streamsRef.current = [media.mic, ...media.cameras.map((c) => c.stream)].filter((s): s is MediaStream => Boolean(s))
      void setCameraMode(db, id, media.mode)

      // Silent observer (mic + both camera feeds in; nothing played back).
      if (media.mic) {
        try {
          observerRef.current = await startSilentObserver(db, id, {
            micStream: media.mic,
            videoStreams: media.cameras.map((c) => c.stream),
          })
        } catch {
          // No AI observer (e.g. no key) — the live feed and recordings still run.
        }
      }

      // Live video to the dashboard: publish EVERY camera so a responder can switch between front and back (Epic
      // 11 / 14.2). Each camera signals independently under its own feed.
      for (const cam of media.cameras) {
        try {
          const stop = await startVideoPublisher(db, id, videoOnly(cam.stream), { camera: cam.facing })
          publisherStopsRef.current.push(stop)
        } catch {
          // Blocked WebRTC for one camera just means no live feed for it; the others still stream.
        }
      }

      // Record every camera (video + mic audio) for the team's Drive.
      if (driveConfigured) {
        for (const cam of media.cameras) {
          const recStream = new MediaStream([...cam.stream.getVideoTracks(), ...(media.mic?.getAudioTracks() ?? [])])
          const rec = startVideoRecording(recStream)
          if (rec) {
            recordersRef.current.push({ facing: cam.facing, rec })
            void upsertVideoRecording(db, id, { camera: cam.facing, status: 'recording', startedAt: new Date().toISOString() })
          }
        }
        // Periodic snapshot uploads per camera so a long SOS (or one force-closed) still leaves footage (Epic 9.2).
        snapshotTimerRef.current = setInterval(() => {
          for (const { facing, rec } of recordersRef.current) {
            const blob = rec.snapshot()
            if (blob) void uploadCallVideo(blob, { incidentId: id, camera: facing, mimeType: rec.mimeType }).catch(() => {})
          }
        }, 20_000)
      }
    })()
  }, [])

  const endSos = async () => {
    if (endingRef.current) return
    endingRef.current = true
    const id = incidentIdRef.current

    if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current)
    // Stop the Drive recorders while the camera tracks are still live, then kick off uploads in the background.
    const recordings = await Promise.all(
      recordersRef.current.map(async ({ facing, rec }) => ({ facing, blob: await rec.stop(), mimeType: rec.mimeType })),
    )
    const transcript = observerRef.current?.getTranscript() ?? ''
    await observerRef.current?.end()
    await Promise.all(publisherStopsRef.current.map((stop) => stop().catch(() => {})))
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    await wakeLockRef.current?.release().catch(() => {})

    if (id) {
      // Consolidate + leakage-check, same as a call end (best-effort).
      try {
        const snap = await getDoc(doc(db, INCIDENTS, id))
        const incident = snap.data() as Omit<Incident, 'id'> | undefined
        const fields = incident?.extractedFieldsLive ?? { peopleCount: null, dangerIndicators: [], urgency: null, notes: null }
        const stressTrend = incident?.voiceStressTrend ?? []
        const address = incident?.location.confirmed?.address ?? null
        const [consolidation, redactions] = await Promise.all([
          consolidateCall(transcript, fields, stressTrend, address),
          runLeakageCheck(transcript),
        ])
        await Promise.all([consolidateIncident(db, id, consolidation), recordLeakageCheck(db, id, redactions)])

        if (address) {
          void groundedLocationContext(address).then((context) => {
            if (context) void recordGroundedContext(db, id, context)
          })
        }
      } catch {
        // Best-effort: the live-extracted fields are already saved.
      }

      for (const { facing, blob, mimeType } of recordings) {
        if (!blob) continue
        void (async () => {
          try {
            const result = await uploadCallVideo(blob, { incidentId: id, camera: facing, mimeType })
            await upsertVideoRecording(db, id, {
              camera: facing,
              status: 'uploaded',
              driveFileId: result?.driveFileId ?? null,
              driveUrl: result?.driveUrl ?? null,
              endedAt: new Date().toISOString(),
            })
          } catch {
            await upsertVideoRecording(db, id, { camera: facing, status: 'failed', endedAt: new Date().toISOString() }).catch(() => {})
          }
        })()
      }

      zeroTraceExit(db, id, navigate)
    } else {
      navigate('/', { replace: true })
    }
  }

  const onCornerTap = () => {
    tapCountRef.current += 1
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      void endSos()
      return
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 1500)
  }

  // The whole screen is black and swallows touches so nothing shows the phone is active; only the hidden
  // top-left corner responds, and only to the three-tap exit.
  return (
    <div
      className="sos-blackout"
      onPointerDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="sos-exit-hotspot" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onCornerTap() }} />
    </div>
  )
}
