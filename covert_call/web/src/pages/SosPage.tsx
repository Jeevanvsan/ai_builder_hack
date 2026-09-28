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
  recordCorrelatedIncidents,
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
import { findCorrelatedIncidents } from '../lib/gemini/correlate'
import { zeroTraceExit } from '../lib/gemini/exit'

// Caps any single teardown step so leaving the SOS screen can never hang: a MediaRecorder stuck in 'recording'
// state (camera killed by the OS, permission revoked mid-session) or a Gemini Live session slow to close would
// otherwise block the whole exit gesture forever, since it awaits each step in sequence before navigating away.
const TEARDOWN_STEP_TIMEOUT_MS = 3000
function withTimeout<T>(p: Promise<T>, fallback: T, ms = TEARDOWN_STEP_TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
}

// The silent SOS screen (Epic 11). Reached ONLY by double-tapping the heart on the home screen. It shows a
// full-black "the phone is off" overlay while it silently records both cameras + the mic, streams the back camera
// to the dashboard, and lets a silent Gemini observer build the incident. The person leaves with a secret gesture:
// three taps anywhere on the screen.
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

  // Secret exit: three taps anywhere on the screen within 1.5s.
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
        } catch (e) {
          // This previously swallowed EVERY possible failure (bad/missing key, quota, malformed config, network)
          // with zero logging anywhere — the single biggest reason repeated SOS tests showed "no transcript, no
          // observations" with no way to tell why. Now surfaced loudly so the real cause is visible next time.
          console.error('[QuickBite SOS] silent observer failed to start — no AI observation this session:', e)
        }
      } else {
        console.warn('[QuickBite SOS] no mic stream acquired — silent observer was never started')
      }

      // Live video to the dashboard: publish EVERY camera so a responder can switch between front and back (Epic
      // 11 / 14.2). Each camera signals independently under its own feed.
      console.log(`[QuickBite SOS] cameras that passed the frame check and will be published: ${media.cameras.map((c) => c.facing).join(', ') || 'none'}`)
      for (const cam of media.cameras) {
        try {
          const stop = await startVideoPublisher(db, id, videoOnly(cam.stream), { camera: cam.facing })
          publisherStopsRef.current.push(stop)
        } catch (e) {
          // Blocked WebRTC for one camera just means no live feed for it; the others still stream. Previously
          // silent — now logged, since "which camera failed and why" was invisible in every prior test.
          console.error(`[QuickBite SOS] live feed publisher failed for ${cam.facing} camera:`, e)
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
    // Each recorder's own stop() now has an internal timeout too (videoRecorder.ts) — this outer one is defence in
    // depth so a single stuck recorder can't hold up the others or the rest of the exit sequence.
    const transcript = observerRef.current?.getTranscript() ?? ''
    const recordings = await withTimeout(
      Promise.all(recordersRef.current.map(async ({ facing, rec }) => ({ facing, blob: await rec.stop(), mimeType: rec.mimeType }))),
      recordersRef.current.map(({ facing, rec }) => ({ facing, blob: null, mimeType: rec.mimeType })),
    )
    // observer.end() closes the Gemini Live session — confirmed hang risk if the session's own close() is slow or
    // the socket is already in a bad state (see silentSession.ts's onclose reconnect handling).
    await withTimeout(observerRef.current?.end() ?? Promise.resolve(), undefined)
    await withTimeout(Promise.all(publisherStopsRef.current.map((stop) => stop().catch(() => {}))), [])
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    await wakeLockRef.current?.release().catch(() => {})

    if (id) {
      // Consolidate (case summary/bulletin + the leakage/privacy check, one request), same as a call end
      // (best-effort). This is a real network call to Gemini with NO timeout of its own — a slow/hung request
      // here previously blocked zeroTraceExit() from ever running, leaving the black screen stuck no matter how
      // many times the exit gesture fired (all the teardown-step timeouts above only guard steps BEFORE this
      // block). Capped at 8s so a slow AI call can never hold the exit hostage; the recording and every
      // live-extracted field are already saved regardless of whether this finishes.
      try {
        await withTimeout(
          (async () => {
            const snap = await getDoc(doc(db, INCIDENTS, id))
            const incident = snap.data() as Omit<Incident, 'id'> | undefined
            const fields = incident?.extractedFieldsLive ?? { peopleCount: null, dangerIndicators: [], urgency: null, notes: null }
            const stressTrend = incident?.voiceStressTrend ?? []
            const address = incident?.location.confirmed?.address ?? null
            const consolidation = await consolidateCall(transcript, fields, stressTrend, address)
            await Promise.all([consolidateIncident(db, id, consolidation), recordLeakageCheck(db, id, consolidation.redactions)])

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
          })(),
          undefined,
          8000,
        )
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

  // Three taps ANYWHERE on the screen, within 1.5s of each other, end the SOS. onPointerDown covers touch, mouse
  // and pen uniformly, and the whole overlay (not just a corner) listens, so the gesture works no matter where on
  // the dead-looking black screen the person taps.
  const onExitTap = () => {
    tapCountRef.current += 1
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      void endSos()
      return
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 1500)
  }

  return (
    <div
      className="sos-blackout"
      onPointerDown={(e) => { e.preventDefault(); onExitTap() }}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
