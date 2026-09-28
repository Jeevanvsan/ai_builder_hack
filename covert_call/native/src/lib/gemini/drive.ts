import { doc, setDoc, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../../../../shared/incidents/client'
import { DRIVE_UPLOAD_URL } from '../config'

// Native port of web/src/lib/gemini/videoUpload.ts + uploadRecording.ts.
//
// Same Apps Script endpoint as the web, and the same per-incident Drive subfolder layout, so recordings from the
// phone land next to recordings from the browser. The only change is the input: base64 is passed in directly
// rather than read out of a Blob with FileReader, which React Native doesn't have.

export interface DriveUploadResult {
  driveFileId: string
  driveUrl: string
}

// Sends a recording to the Apps Script endpoint, which creates the Drive file and returns its id and shareable
// URL. Returns null if Drive isn't configured. Throws on a network/endpoint error so the caller can mark the
// recording as failed rather than silently dropping it.
export async function uploadRecordingToDrive(
  payload: { base64: string; mimeType: string },
  meta: { incidentId: string; camera: 'back' | 'front' | 'audio' },
): Promise<DriveUploadResult | null> {
  if (!DRIVE_UPLOAD_URL) return null

  const ext = payload.mimeType.includes('mp4')
    ? 'mp4'
    : payload.mimeType.includes('wav')
      ? 'wav'
      : payload.mimeType.includes('ogg')
        ? 'ogg'
        : 'webm'

  const res = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps don't handle.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      incidentId: meta.incidentId,
      // Each incident gets its own Drive subfolder, keyed by incidentId server-side, so the file only needs its
      // own name inside that folder.
      filename: `${meta.camera}.${ext}`,
      mimeType: payload.mimeType,
      base64: payload.base64,
    }),
  })

  if (!res.ok) throw new Error(`Drive upload failed: HTTP ${res.status}`)
  const data = (await res.json()) as { fileId?: string; url?: string; error?: string }
  // Apps Script's doPost() catches its own internal errors and still responds 200 with { error: "..." } — a
  // payload too large, a Drive quota issue, a script timeout. Treating that as success is what previously wrote
  // "uploaded" rows with null ids, so surface the real reason instead.
  if (data.error) throw new Error(`Drive upload rejected: ${data.error}`)
  if (!data.fileId || !data.url) throw new Error('Drive upload returned no file — response missing fileId/url')
  return { driveFileId: data.fileId, driveUrl: data.url }
}

// Firestore fallback when Drive isn't configured or its upload failed, matching the web's
// incidents/{id}/recording/audio document. Firestore caps a document at 1MiB, and native records uncompressed
// WAV (see recorder.ts), so in practice this only fits a very short call — it throws rather than silently
// truncating, and the caller records the reason on the incident.
const MAX_DOC_BYTES = 1_000_000

export async function saveRecordingToFirestore(
  db: Firestore,
  incidentId: string,
  payload: { base64: string; mimeType: string },
): Promise<void> {
  if (payload.base64.length > MAX_DOC_BYTES) {
    throw new Error(
      `Recording too large for Firestore (${Math.round(payload.base64.length / 1024)}KB base64, limit ~1MB) — skipped.`,
    )
  }
  await setDoc(doc(db, INCIDENTS, incidentId, 'recording', 'audio'), {
    base64: payload.base64,
    mimeType: payload.mimeType,
    savedAt: new Date().toISOString(),
  })
}
