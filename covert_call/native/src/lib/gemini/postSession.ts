import { doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore'
import {
  INCIDENTS,
  consolidateIncident,
  recordLeakageCheck,
  recordGroundedContext,
  recordCorrelatedIncidents,
  setAudioRecording,
  markHasRecording,
} from '../../../../shared/incidents/client'
import type { Incident } from '../../../../shared/incidents/types'
import { consolidateCall } from './consolidate'
import { groundedLocationContext } from './groundedContext'
import { findCorrelatedIncidents } from './correlate'
import { uploadRecordingToDrive, saveRecordingToFirestore } from './drive'
import { driveConfigured } from '../config'

// The end-of-session work that CallPage.tsx and SosPage.tsx each run on the web. It is identical between the two
// there (and was duplicated), so on native it lives in one place and both screens call it.

// Caps a slow/hung best-effort step so it can never block the rest of teardown. Everything here is optional
// enrichment — the live-extracted fields are already saved — but with no timeout a stalled request would keep
// the caller staring at a screen that won't close.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))])
}

const CONSOLIDATION_CAP_MS = 8000

// Case summary + bulletin + privacy check, then (in the background) local context and cross-case correlation.
export async function runPostSessionPasses(db: Firestore, incidentId: string, transcript: string): Promise<void> {
  try {
    await withTimeout(
      (async () => {
        const snap = await getDoc(doc(db, INCIDENTS, incidentId))
        const incident = snap.data() as Omit<Incident, 'id'> | undefined
        const fields = incident?.extractedFieldsLive ?? {
          peopleCount: null,
          dangerIndicators: [],
          urgency: null,
          notes: null,
        }
        const stressTrend = incident?.voiceStressTrend ?? []
        const address = incident?.location.confirmed?.address ?? null

        // Retry once: a transient blip or rate limit shouldn't permanently lose the case summary.
        const withRetry = <T,>(fn: () => Promise<T>) => fn().catch(() => fn())
        try {
          const consolidation = await withRetry(() => consolidateCall(transcript, fields, stressTrend, address))
          await Promise.all([
            consolidateIncident(db, incidentId, consolidation),
            recordLeakageCheck(db, incidentId, consolidation.redactions),
          ])
        } catch (e) {
          console.error('[QuickBite] consolidation failed after retry:', e)
          // Flagged rather than left blank, so the dashboard can say why there's no summary.
          await updateDoc(doc(db, INCIDENTS, incidentId), { consolidationFailed: true }).catch(() => {})
        }

        if (address) {
          void groundedLocationContext(address).then((context) => {
            if (context) void recordGroundedContext(db, incidentId, context)
          })
        }

        if (incident) {
          void findCorrelatedIncidents(db, { ...incident, id: incidentId }).then((matchIds) => {
            if (matchIds.length) void recordCorrelatedIncidents(db, incidentId, matchIds)
          })
        }
      })(),
      CONSOLIDATION_CAP_MS,
    )
  } catch {
    // Best-effort: every field extracted during the session is already saved regardless.
  }
}

// Drive first (no size cap), Firestore second, and an explicit failure on the incident if both fail — the same
// chain as the web, so the dashboard's recordings panel behaves identically for a phone-raised case.
export async function uploadCallAudio(
  db: Firestore,
  incidentId: string,
  recording: { base64: string; mimeType: string },
): Promise<void> {
  const startedAt = new Date().toISOString()

  if (driveConfigured) {
    await updateDoc(doc(db, INCIDENTS, incidentId), {
      audioRecording: { status: 'recording', startedAt },
    }).catch(() => {})

    try {
      const result = await uploadRecordingToDrive(recording, { incidentId, camera: 'audio' })
      await setAudioRecording(db, incidentId, {
        status: 'uploaded',
        driveFileId: result?.driveFileId ?? null,
        driveUrl: result?.driveUrl ?? null,
        startedAt,
        endedAt: new Date().toISOString(),
      })
      return
    } catch (e) {
      console.error('[QuickBite] Drive audio upload failed, falling back to Firestore:', e)
      await setAudioRecording(db, incidentId, {
        status: 'failed',
        startedAt,
        endedAt: new Date().toISOString(),
      }).catch(() => {})
    }
  }

  try {
    await saveRecordingToFirestore(db, incidentId, recording)
    await markHasRecording(db, incidentId)
  } catch (e) {
    console.error('[QuickBite] saving the recording failed:', e)
    await updateDoc(doc(db, INCIDENTS, incidentId), {
      recordingFailed: e instanceof Error ? e.message.slice(0, 200) : 'Unknown error',
    }).catch(() => {})
  }
}
