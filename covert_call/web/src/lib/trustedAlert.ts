import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
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

// After a call: if the caller gave an email (send_case_report), ask the Apps Script to email them the case report.
// The script reads the address from the incident itself, never from this request, so the open script URL can't be
// used to mail anyone else. Best effort, and only once the summary has been written (or has failed).
export function sendCaseReport(incidentId: string, reportEmail: string | undefined): void {
  if (!ALERT_URL || !reportEmail || isDemoMode()) return
  void fetch(ALERT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ type: 'case_report', incidentId }),
  }).catch(() => {})
}
