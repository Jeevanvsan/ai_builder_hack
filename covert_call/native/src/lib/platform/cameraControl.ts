import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../../../../shared/incidents/client'
import type { RtcStream } from './camera'

// Lets a responder flip the phone between its front and back camera from the dashboard, mid-session.
//
// Why this rather than publishing both cameras at once: most phones refuse two simultaneous camera streams (this
// project's own test phone does), so the SOS's "dual" path usually degrades to back-only and the responder never
// sees the other side at all. Flipping one live track works on every device, and it keeps a single feed and a
// single peer connection rather than doubling both.
//
// The dashboard asks for a camera by writing to the incident:
//
//   videoControl: { facing: 'front' | 'back', requestedAt: <ISO string> }
//
// The phone owns the actual switch; the field is a request, not a statement of fact. Nothing here writes back,
// so a responder pressing the button on a phone that can't switch simply sees no change.
//
// Inert until something writes that field, so it is safe to ship ahead of the dashboard control.

export type CameraSwitchWatcher = { stop: () => void }

export function watchCameraSwitchRequests(
  db: Firestore,
  incidentId: string,
  getStream: () => RtcStream | null,
): CameraSwitchWatcher {
  // The first snapshot arrives immediately with whatever is already stored. Acting on it would flip the camera
  // the moment a session starts if an older incident happened to carry the field, so the first value is only
  // recorded, never applied.
  let seenInitial = false
  let applied: string | null = null

  const unsubscribe = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    const control = snap.data()?.videoControl as { facing?: string; requestedAt?: string } | undefined
    const requestedAt = control?.requestedAt ?? null

    if (!seenInitial) {
      seenInitial = true
      applied = requestedAt
      return
    }
    if (!requestedAt || requestedAt === applied) return
    applied = requestedAt

    const track = getStream()?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined
    if (!track?._switchCamera) return

    try {
      // react-native-webrtc flips the existing track in place, so the peer connection and the dashboard's
      // <video> element both carry on untouched — the picture simply changes.
      track._switchCamera()
      console.log(`[QuickBite] camera switched to ${control?.facing ?? 'other'} at the responder's request`)
    } catch (e) {
      console.warn('[QuickBite] camera switch failed:', e)
    }
  })

  return { stop: unsubscribe }
}
