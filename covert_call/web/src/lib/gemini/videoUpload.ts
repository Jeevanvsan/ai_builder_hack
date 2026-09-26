// Uploads a recorded call video to the team's Google Drive via a small Apps Script web app (Epic 9.2). This
// avoids Firebase Storage (which needs the paid Blaze plan) and needs no caller sign-in: the Apps Script runs as
// the team's own Google account and drops the file into one shared Drive folder. Deploy steps and the script
// itself are in covert_call/docs/setup/drive-uploader.md.
//
// Configured by VITE_DRIVE_UPLOAD_URL (the Apps Script deployment URL). If unset, uploads are skipped and the
// call still works — same pattern as the other billing/infra-gated features.

const UPLOAD_URL = import.meta.env.VITE_DRIVE_UPLOAD_URL as string | undefined

export const driveConfigured = Boolean(UPLOAD_URL)

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

export interface DriveUploadResult {
  driveFileId: string
  driveUrl: string
}

// Sends the video to the Apps Script endpoint, which creates the Drive file and returns its id and shareable URL.
// Returns null if Drive isn't configured. Throws on a network/endpoint error so the caller can mark the recording
// as failed rather than silently dropping it.
export async function uploadCallVideo(
  blob: Blob,
  meta: { incidentId: string; camera: 'back' | 'front'; mimeType: string },
): Promise<DriveUploadResult | null> {
  if (!UPLOAD_URL) return null
  const base64 = await blobToBase64(blob)
  const ext = meta.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps don't handle.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      incidentId: meta.incidentId,
      filename: `${meta.incidentId}-${meta.camera}.${ext}`,
      mimeType: meta.mimeType,
      base64,
    }),
  })
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
  const data = (await res.json()) as { fileId: string; url: string }
  return { driveFileId: data.fileId, driveUrl: data.url }
}
