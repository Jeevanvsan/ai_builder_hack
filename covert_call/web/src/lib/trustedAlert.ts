import { addDoc, collection, doc, onSnapshot, updateDoc, type Firestore } from 'firebase/firestore'
import type { Incident } from '../../../shared/incidents/types.ts'
import { buildCaseSketch } from './caseSketch'
import { buildSceneSketchImage } from './sceneSketchImage'
import { INCIDENTS, isDemoMode } from '../../../shared/incidents/client.ts'
import { loadProfile } from './caller'

// Epic 32: when this call turns high severity, email the caller's trusted contacts once, through the QuickBite
// Apps Script (docs/setup/trusted-alert.md). The script re-checks the incident itself before sending. Best effort:
// with no URL, no contacts, or a failure, nothing happens and the call carries on.
const ALERT_URL = import.meta.env.VITE_TRUSTED_ALERT_URL as string | undefined

export function watchForTrustedAlert(db: Firestore, incidentId: string): () => void {
  if (!ALERT_URL || isDemoMode()) return () => {}
  let sent = false
  const stop = onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
    if (sent || snap.data()?.severity !== 'high') return
    sent = true
    stop()
    void (async () => {
      const { contacts } = await loadProfile()
      if (!contacts.length) return
      // text/plain keeps this a "simple" request (no CORS preflight, which Apps Script doesn't answer).
      await fetch(ALERT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ incidentId, contacts }),
      }).catch(() => {})
    })()
  }, () => {})
  return stop
}

// The moment a call ends: if the caller gave an email (send_case_report), mark the report as sending, draw the
// scene sketch, save it with the camera snaps, and ask the Apps Script to send it. The script reads the address
// from the incident itself (never from this request), waits briefly for the AI summary, emails the report with a
// PDF, and records 'sent' or 'failed' on the incident for the dashboard.
export async function startCaseReport(db: Firestore, incidentId: string, incident: Omit<Incident, 'id'> | undefined): Promise<void> {
  if (!ALERT_URL || !incident?.reportEmail || isDemoMode()) return
  const now = () => new Date().toISOString()
  await updateDoc(doc(db, INCIDENTS, incidentId), { reportEmailStatus: { status: 'sending', to: incident.reportEmail, at: now() } }).catch(() => {})
  // The dashboard's scene sketch (who, what, where, the route) and the map of locations and route.
  const [scene, map] = await Promise.all([
    buildSceneSketchImage(incidentId, incident).catch(() => null),
    buildCaseSketch(incidentId, incident).catch(() => null),
  ])
  const save = (kind: 'sketch' | 'map', base64: string, caption: string) =>
    addDoc(collection(db, INCIDENTS, incidentId, 'snaps'), { kind, base64, mimeType: 'image/jpeg', at: now(), caption }).catch(() => {})
  await Promise.all([
    scene && save('sketch', scene, 'Scene sketch, as drawn on the responder dashboard'),
    map && save('map', map, 'Map: the address given, the movement trail and the route to safety'),
  ])
  await fetch(ALERT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ type: 'case_report', incidentId }),
  }).catch(() => {})
}
