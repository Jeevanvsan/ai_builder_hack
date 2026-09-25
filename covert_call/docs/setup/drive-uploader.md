# Google Drive uploader (Epic 9.2)

The QuickBite app saves each call's back-camera video to **one shared Google Drive folder** owned by the team.
Callers never sign in, and this needs **no billing** (unlike Firebase Storage, which requires the Blaze plan).

A tiny **Google Apps Script web app** receives the video and drops it into a Drive folder as the team account.
The app posts to it from `web/src/lib/gemini/videoUpload.ts`.

## 1. Create the Drive folder
1. In the team Google account, make a folder (e.g. `QuickBite Call Videos`).
2. Open it and copy the folder ID from the URL: `drive.google.com/drive/folders/<FOLDER_ID>`.

## 2. Create the Apps Script
1. Go to <https://script.google.com> → **New project**.
2. Replace `Code.gs` with the script below, pasting your folder ID.
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me** (the team account).
   - Who has access: **Anyone**.
4. Copy the **Web app URL** (ends in `/exec`).

```javascript
// Apps Script: receives a base64 video from the QuickBite app and saves it to one Drive folder.
const FOLDER_ID = 'PASTE_YOUR_FOLDER_ID_HERE'

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const bytes = Utilities.base64Decode(body.base64)
    const blob = Utilities.newBlob(bytes, body.mimeType || 'video/webm', body.filename || 'call.webm')
    const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob)
    // Anyone in the team with the folder can already view it; return a link responders can open.
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

## Prototype limits (state these plainly, don't hide them)
- The uploader URL sits in the client bundle — anyone reading the JS can POST to it. Acceptable for a hackathon
  prototype; a real build would put a secret/token in front of it or move it behind Cloud Run.
- The video is uploaded **when the call ends**, not streamed during it, so a call killed mid-way (tab closed
  before the End button) leaves no Drive video. Chunked-during-call upload is a follow-up (backlog 9.2).
- Apps Script limits a single request to a few tens of MB, which comfortably covers a short demo call at the
  app's ~0.8 Mbps video bitrate.
