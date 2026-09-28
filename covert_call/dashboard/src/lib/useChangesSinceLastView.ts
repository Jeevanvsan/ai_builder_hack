import { useEffect, useRef, useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'

// Epic 16.8: "what changed since I last looked" — a snapshot of the fields a responder actually cares about,
// taken each time they open an incident, kept in localStorage (per-browser, not synced — this is a personal
// "did I already see this" convenience, not shared state, so it doesn't need Firestore).
type Snapshot = {
  address: string | null
  dangerIndicators: string[]
  urgency: string | null
  notesLength: number
  severity: string
}

const KEY_PREFIX = 'quickbite-last-seen:'

function snapshotOf(incident: Incident): Snapshot {
  return {
    address: incident.location.confirmed?.address ?? null,
    dangerIndicators: incident.extractedFieldsLive.dangerIndicators,
    urgency: incident.extractedFieldsLive.urgency,
    notesLength: incident.extractedFieldsLive.notes?.length ?? 0,
    severity: incident.severity,
  }
}

function diffLines(before: Snapshot, after: Snapshot): string[] {
  const lines: string[] = []
  if (!before.address && after.address) lines.push('address confirmed')
  const newIndicators = after.dangerIndicators.filter((d) => !before.dangerIndicators.includes(d))
  if (newIndicators.length) lines.push(`${newIndicators.length} new danger indicator${newIndicators.length > 1 ? 's' : ''}`)
  if (after.urgency && after.urgency !== before.urgency) lines.push(`urgency raised to ${after.urgency}`)
  if (after.notesLength > before.notesLength) lines.push('new notes')
  if (after.severity !== before.severity) lines.push(`severity now ${after.severity}`)
  return lines
}

// Returns a short summary of what changed since this browser last viewed the incident, or null if this is the
// first view (or nothing material changed) — then updates the stored snapshot to the incident's current state.
export function useChangesSinceLastView(incident: Incident | null | undefined): string[] | null {
  const [changes, setChanges] = useState<string[] | null>(null)
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!incident || handled.current === incident.id) return
    handled.current = incident.id
    const key = `${KEY_PREFIX}${incident.id}`
    try {
      const raw = localStorage.getItem(key)
      const current = snapshotOf(incident)
      if (raw) {
        const lines = diffLines(JSON.parse(raw) as Snapshot, current)
        setChanges(lines.length ? lines : null)
      }
      localStorage.setItem(key, JSON.stringify(current))
    } catch {
      // Private browsing / storage blocked — the banner just won't appear, nothing else depends on this.
    }
  }, [incident])

  return changes
}
