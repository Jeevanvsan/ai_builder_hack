import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { db } from './firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'
import type { Incident } from '../../../shared/incidents/types'


// The backend may write Firestore Timestamps; the UI works with ISO strings throughout.
function normalize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]))
  }
  return value
}

export function toIncident(id: string, data: Record<string, unknown>): Incident {
  return { ...(normalize(data) as Omit<Incident, 'id'>), id }
}

type State<T> = { data: T; loading: boolean; error: string | null }

export type IncidentScope = 'open' | 'resolved' | 'all'

// Queue and history each subscribe to only their own slice, so the live queue never downloads the whole case archive.
// Analytics needs the full set, so 'all' skips the status filter entirely.
export const scopeQuery = (scope: IncidentScope) =>
  scope === 'resolved'
    ? query(collection(db, INCIDENTS), where('response.status', '==', 'resolved'))
    : scope === 'open'
      ? query(collection(db, INCIDENTS), where('response.status', 'in', ['new', 'acknowledged', 'in_progress']))
      : query(collection(db, INCIDENTS))

export function useIncidents(scope: IncidentScope): State<Incident[]> {
  const [state, setState] = useState<State<Incident[]>>({ data: [], loading: true, error: null })
  useEffect(
    () =>
      onSnapshot(
        scopeQuery(scope),
        (snap) => setState({ data: snap.docs.map((d) => toIncident(d.id, d.data())), loading: false, error: null }),
        (err) => setState({ data: [], loading: false, error: err.message }),
      ),
    [scope],
  )
  return state
}

export function useIncident(id: string | undefined): State<Incident | null> {
  const [state, setState] = useState<State<Incident | null> & { forId?: string }>({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, INCIDENTS, id),
      (snap) => setState({ forId: id, data: snap.exists() ? toIncident(snap.id, snap.data()) : null, loading: false, error: null }),
      (err) => setState({ forId: id, data: null, loading: false, error: err.message }),
    )
  }, [id])
  // Until the snapshot for the current id arrives, report loading rather than the previous incident.
  return state.forId === id ? state : { data: null, loading: true, error: null }
}
