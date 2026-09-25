import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.ts'
import { INCIDENTS } from '../../../../shared/incidents/client.ts'

// Firestore has no billing-free blob storage (Firebase Storage now requires the Blaze plan) — so the recording
// is base64-encoded and saved as its own document in a subcollection, keeping the main incident document small.
// Firestore caps a document at 1MiB; base64 adds ~33% overhead, so this comfortably fits a short demo/test call
// but WILL fail for a long one — that's an accepted tradeoff for now, not a bug, given the no-billing constraint.
const MAX_DOC_BYTES = 1_000_000

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Saves the recording at incidents/{id}/recording/audio. Throws if it won't fit in one Firestore document —
// the caller in CallPage.tsx treats this as best-effort and doesn't block ending the call on it.
export async function saveCallRecording(incidentId: string, recording: Blob): Promise<{ base64: string; mimeType: string }> {
  const base64 = await blobToBase64(recording)
  if (base64.length > MAX_DOC_BYTES) {
    throw new Error(`Recording too large for Firestore (${Math.round(base64.length / 1024)}KB base64, limit ~1MB) — skipped.`)
  }
  const mimeType = recording.type || 'audio/webm'
  await setDoc(doc(db, INCIDENTS, incidentId, 'recording', 'audio'), { base64, mimeType, savedAt: new Date().toISOString() })
  return { base64, mimeType }
}
