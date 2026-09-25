import type { NavigateFunction } from 'react-router-dom'
import type { Firestore } from 'firebase/firestore'
import { endIncident } from '../../../../shared/incidents/client.ts'

// Story 1.4: used by both the live-call End button and the silent-tap Submit button. Ends the incident and
// returns to Home in a way that doesn't leave the call/tap page reachable via the browser's back button.
export function zeroTraceExit(db: Firestore, incidentId: string, navigate: NavigateFunction): void {
  void endIncident(db, incidentId)
  navigate('/', { replace: true })
}
