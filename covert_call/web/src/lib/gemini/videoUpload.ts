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
      // The recorder's MIME type carries codec params ("video/webm;codecs=vp8,opus"), which itself contains a
      // comma — indexOf(',') found THAT comma instead of the real "base64," marker, so every upload silently
      // prepended a fragment like "opus;base64," onto the payload. Apps Script's base64Decode() then threw
      // "Could not decode string" on the corrupted lead bytes, confirmed on real failed uploads (a 36s, ~5MB
      // clip — far under any size limit, so it was never a size problem). The real "base64," marker is always the
      // LAST comma before the payload starts, since only the payload itself can contain more commas after it.
      const marker = ';base64,'
      const idx = result.indexOf(marker)
      resolve(idx === -1 ? result.slice(result.indexOf(',') + 1) : result.slice(idx + marker.length))
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
  meta: { incidentId: string; camera: 'back' | 'front' | 'audio'; mimeType: string },
): Promise<DriveUploadResult | null> {
  if (!UPLOAD_URL) return null
  const base64 = await blobToBase64(blob)
  // Reused for the call's audio recording too (mimeType then reads audio/webm or audio/ogg, never mp4/webm video).
  const ext = meta.mimeType.includes('mp4') ? 'mp4' : meta.mimeType.includes('ogg') ? 'ogg' : 'webm'
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps don't handle.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      incidentId: meta.incidentId,
      // The incidentId no longer needs to be IN the filename — each incident gets its own Drive subfolder (see
      // drive-uploader.md), keyed by incidentId server-side. Just the recording's own name inside that folder.
      filename: `${meta.camera}.${ext}`,
      mimeType: meta.mimeType,
      base64,
    }),
  })
  if (!res.ok) throw new Error(`Drive upload failed: HTTP ${res.status}`)
  const data = (await res.json()) as { fileId?: string; url?: string; error?: string }
  // Apps Script's own doPost() catches its internal errors and still responds 200 with { error: "..." } — a
  // request too large for its size limit, a Drive quota issue, a script timeout. Previously that response was
  // treated as success and destructured into fileId: undefined, silently written as a driveFileId of null with no
  // way to tell why (confirmed on real incidents: several calls' video entries were "status: uploaded" with both
  // driveFileId and driveUrl null). Surface the actual reason instead of guessing.
  if (data.error) throw new Error(`Drive upload rejected: ${data.error}`)
  if (!data.fileId || !data.url) throw new Error('Drive upload returned no file — response missing fileId/url')
  return { driveFileId: data.fileId, driveUrl: data.url }
}
