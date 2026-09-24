import { arrayUnion, doc, runTransaction, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'

export class AlreadyClaimedError extends Error {
  by: string | null
  constructor(by: string | null) {
    super(by ? `Already acknowledged by ${by}` : 'Already acknowledged by another responder')
    this.by = by
  }
}

const ref = (id: string) => doc(db, INCIDENTS, id)
const now = () => new Date().toISOString()

// Transaction so two responders clicking at once can't both claim the same incident.
export async function acknowledge(id: string, responder: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(id))
    const response = snap.data()?.response
    if (response?.status !== 'new') throw new AlreadyClaimedError(response?.acknowledgedBy ?? null)
    tx.update(ref(id), {
      'response.status': 'acknowledged',
      'response.acknowledgedBy': responder,
      'response.acknowledgedAt': now(),
    })
  })
}

export function startResponse(id: string): Promise<void> {
  return updateDoc(ref(id), { 'response.status': 'in_progress' })
}

// A resolved case can't still be a live call: if the session never ended (caller's app closed, lost signal),
// resolving closes it too so the dashboard never shows 'call in progress' on a resolved case.
export function resolve(id: string, callStillActive: boolean): Promise<void> {
  const at = now()
  return updateDoc(ref(id), {
    'response.status': 'resolved',
    'response.resolvedAt': at,
    ...(callStillActive ? { callState: 'ended', sessionEndedAt: at } : {}),
  })
}

export function addNote(id: string, responder: string, text: string): Promise<void> {
  return updateDoc(ref(id), { 'response.notes': arrayUnion({ responderId: responder, text, at: now() }) })
}

// First open by any responder clears the "new incident" highlight for everyone.
export function markViewed(id: string, responder: string): Promise<void> {
  return updateDoc(ref(id), { 'response.viewedAt': now(), 'response.viewedBy': responder || null })
}
