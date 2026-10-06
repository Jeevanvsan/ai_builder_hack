import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { db } from './firebase'
import { DEMO_INCIDENTS, LIVE_INCIDENTS } from '../../../shared/incidents/client.ts'
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

// Demo calls (hidden demo + the AI test harness) live in demoIncidents. The queue, history and incident pages show
// them mixed in with real ones (tagged DEMO); analytics, insights and performance stay real-only. Every write for
// an incident goes to the collection it was read from, via incidentDoc().
const demoIds = new Set<string>()
export const isDemoIncident = (id: string) => demoIds.has(id)
export const incidentDoc = (id: string) => doc(db, demoIds.has(id) ? DEMO_INCIDENTS : LIVE_INCIDENTS, id)

type State<T> = { data: T; loading: boolean; error: string | null }

export type IncidentScope = 'open' | 'resolved' | 'all'

// Queue and history each subscribe to only their own slice, so the live queue never downloads the whole case archive.
// Analytics needs the full set, so 'all' skips the status filter entirely.
export const scopeQuery = (scope: IncidentScope, col: string = LIVE_INCIDENTS) =>
  scope === 'resolved'
    ? query(collection(db, col), where('response.status', '==', 'resolved'))
    : scope === 'open'
      ? query(collection(db, col), where('response.status', 'in', ['new', 'acknowledged', 'in_progress']))
      : query(collection(db, col))

export function useIncidents(scope: IncidentScope): State<Incident[]> {
  const [state, setState] = useState<State<Incident[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    // 'all' feeds analytics/performance: real incidents only.
    const cols = scope === 'all' ? [LIVE_INCIDENTS] : [LIVE_INCIDENTS, DEMO_INCIDENTS]
    const parts = new Map<string, Incident[]>()
    const unsubs = cols.map((col) =>
      onSnapshot(
        scopeQuery(scope, col),
        (snap) => {
          parts.set(col, snap.docs.map((d) => {
            if (col === DEMO_INCIDENTS) demoIds.add(d.id)
            return toIncident(d.id, col === DEMO_INCIDENTS ? { ...d.data(), isDemo: true } : d.data())
          }))
          if (parts.size === cols.length) setState({ data: cols.flatMap((c) => parts.get(c) ?? []), loading: false, error: null })
        },
        // A failing demo listener must never hide the real queue.
        (err) => {
          if (col === DEMO_INCIDENTS) { parts.set(col, []); if (parts.size === cols.length) setState((s) => ({ ...s, loading: false })); return }
          setState({ data: [], loading: false, error: err.message })
        },
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [scope])
  return state
}

export function useIncident(id: string | undefined): State<Incident | null> {
  const [state, setState] = useState<State<Incident | null> & { forId?: string }>({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!id) return
    // The id can be in either collection; whichever has it wins (real first).
    const found: Record<string, Incident | null | undefined> = {}
    const settle = () => {
      if (found[LIVE_INCIDENTS] === undefined || found[DEMO_INCIDENTS] === undefined) return
      setState({ forId: id, data: found[LIVE_INCIDENTS] ?? found[DEMO_INCIDENTS] ?? null, loading: false, error: null })
    }
    const unsubs = [LIVE_INCIDENTS, DEMO_INCIDENTS].map((col) =>
      onSnapshot(
        doc(db, col, id),
        (snap) => {
          if (snap.exists() && col === DEMO_INCIDENTS) demoIds.add(id)
          found[col] = snap.exists() ? toIncident(snap.id, col === DEMO_INCIDENTS ? { ...snap.data(), isDemo: true } : snap.data()) : null
          settle()
        },
        (err) => {
          if (col === DEMO_INCIDENTS) { found[col] = null; settle(); return }
          setState({ forId: id, data: null, loading: false, error: err.message })
        },
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [id])
  // Until the snapshot for the current id arrives, report loading rather than the previous incident.
  return state.forId === id ? state : { data: null, loading: true, error: null }
}
