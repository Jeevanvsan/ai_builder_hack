import { useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'

type Bulletin = NonNullable<Incident['bulletin']>

const FIELD_LABELS: { key: keyof Bulletin; label: string }[] = [
  { key: 'location', label: 'LOCATION' },
  { key: 'subjects', label: 'SUBJECTS' },
  { key: 'weapons', label: 'WEAPONS' },
  { key: 'vehicle', label: 'VEHICLE' },
  { key: 'status', label: 'STATUS' },
  { key: 'recommendedAction', label: 'ACTION' },
]

function bulletinText(incidentId: string, bulletin: Bulletin): string {
  return [`INCIDENT ${incidentId}`, ...FIELD_LABELS.map(({ key, label }) => `${label}: ${bulletin[key] || '-'}`)].join('\n')
}

// Epic 16.4 (display) + 16.5 (shareable export) in one component since they share the same data — a rigid,
// dispatch-broadcast-style breakdown, plus a one-click copy for handing to someone dispatching over radio who
// isn't looking at this screen. This is a point-in-time snapshot of the bulletin as it stood at consolidation,
// not a live-syncing document.
export default function BulletinCard({ incidentId, bulletin }: { incidentId: string; bulletin: Bulletin }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bulletinText(incidentId, bulletin))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked (permissions, insecure context) — the bulletin is still visible to copy by hand.
    }
  }

  return (
    <div className="card bulletin-card">
      <div className="bulletin-head">
        <h2>Dispatch bulletin</h2>
        <button type="button" className="btn btn-sm" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy for radio/handoff'}
        </button>
      </div>
      <dl className="bulletin-fields mono">
        {FIELD_LABELS.map(({ key, label }) => (
          <div key={key} className="bulletin-row">
            <dt>{label}</dt>
            <dd>{bulletin[key] || '-'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
