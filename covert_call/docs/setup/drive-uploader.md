# Google Drive uploader (Epic 9.2)

The QuickBite app saves each call's recordings — audio, back-camera video, and (for a Silent SOS) front-camera
video too — to Google Drive, **one subfolder per incident** inside a single root folder owned by the team.
Callers never sign in, and this needs **no billing** (unlike Firebase Storage, which requires the Blaze plan).

A tiny **Google Apps Script web app** receives each recording and drops it into that incident's subfolder as the
team account. The app posts to it from `web/src/lib/gemini/videoUpload.ts`.

## 1. Create the Drive folder
1. In the team Google account, make a folder (e.g. `QuickBite Call Videos`) — this becomes the root; every
   incident gets its own subfolder inside it (e.g. `QuickBite Call Videos/INC-MUKRJ1SF/`).
2. Open it and copy the folder ID from the URL: `drive.google.com/drive/folders/<FOLDER_ID>`.

## 2. Create the Apps Script
1. Go to <https://script.google.com> → **New project**.
2. Replace `Code.gs` with the script below, pasting your folder ID.
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me** (the team account).
   - Who has access: **Anyone**.
4. Copy the **Web app URL** (ends in `/exec`).

**If you already have this script deployed from before the per-incident-folder change**, replace `Code.gs` with
the version below and use **Deploy → Manage deployments → Edit → New version** (keeps the same `/exec` URL, no
env var change needed) rather than creating a brand new deployment.

```javascript
// Apps Script: receives a base64 recording from the QuickBite app and saves it into that incident's own
// subfolder (one subfolder per incidentId) inside one root Drive folder.
const ROOT_FOLDER_ID = 'PASTE_YOUR_FOLDER_ID_HERE'

// Reuses an existing subfolder by exact name if one exists (Drive allows duplicate folder names, so a plain
// createFolder() on every call would eventually make two "INC-XXXX" folders for the same incident — this looks
// first).
function getOrCreateIncidentFolder(root, incidentId) {
  const existing = root.getFoldersByName(incidentId)
  if (existing.hasNext()) return existing.next()
  return root.createFolder(incidentId)
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const bytes = Utilities.base64Decode(body.base64)
    const filename = body.filename || 'call.webm'
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID)
    const folder = body.incidentId ? getOrCreateIncidentFolder(root, body.incidentId) : root
    // The app re-uploads the same filename periodically during a call (Epic 9.2 snapshots), then once more at the
    // end — so remove any earlier version of this file first and keep just the latest, complete one.
    const existingFiles = folder.getFilesByName(filename)
    while (existingFiles.hasNext()) existingFiles.next().setTrashed(true)
    const blob = Utilities.newBlob(bytes, body.mimeType || 'video/webm', filename)
    const file = folder.createFile(blob)
    // Anyone in the team with the root folder can already view every subfolder under it; return a link
    // responders can open straight from the dashboard.
    return ContentService
      .createTextOutput(JSON.stringify({ fileId: file.getId(), url: file.getUrl() }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
```

## 3. Point the app at it
Add to `covert_call/web/.env.local` (and document it in `.env.example`):

```
VITE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/XXXX/exec
```

Rebuild the web app. If the variable is unset, video uploads are skipped and the call still works — the live
dashboard feed and the Firestore audio recording are unaffected.

**Native app:** same endpoint, but React Native/Expo reads `EXPO_PUBLIC_*` vars, not `VITE_*`. When native video
recording is implemented (it's currently a stub — `react-native-webrtc` has no `MediaRecorder`), set the same URL
as `EXPO_PUBLIC_DRIVE_UPLOAD_URL` in `native/.env` and reuse this same uploader. Nothing in native reads it yet.

## Prototype limits (state these plainly, don't hide them)
- The uploader URL sits in the client bundle — anyone reading the JS can POST to it. Acceptable for a hackathon
  prototype; a real build would put a secret/token in front of it or move it behind Cloud Run.
- The recording-so-far is uploaded every ~20s during the call (overwriting the same file) and once more at the
  end, so a call killed mid-way still leaves the last snapshot in Drive. Each snapshot re-sends the whole file,
  which is fine for short demo calls but not bandwidth-optimal for long ones.
- Apps Script limits a single request to a few tens of MB, which comfortably covers a short demo call at the
  app's ~0.8 Mbps video bitrate.
