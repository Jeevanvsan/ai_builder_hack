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

type CallerEstimate = NonNullable<import('../../../shared/incidents/types').Incident['callerEstimate']>

function callerEstimateText(c: CallerEstimate): string {
  const parts = [c.ageGroup !== 'unclear' ? c.ageGroup : null, c.gender !== 'unclear' ? c.gender : null].filter(Boolean)
  return parts.length ? `${parts.join(', ')} (AI estimate, unconfirmed)` : 'unclear (AI estimate, unconfirmed)'
}

function bulletinText(incidentId: string, bulletin: Bulletin, callerEstimate?: CallerEstimate): string {
  const lines = [`INCIDENT ${incidentId}`, ...FIELD_LABELS.map(({ key, label }) => `${label}: ${bulletin[key] || '-'}`)]
  if (callerEstimate) lines.push(`CALLER: ${callerEstimateText(callerEstimate)}`)
  return lines.join('\n')
}

// Epic 16.4 (display) + 16.5 (shareable export) in one component since they share the same data — a rigid,
// dispatch-broadcast-style breakdown, plus a one-click copy for handing to someone dispatching over radio who
// isn't looking at this screen. This is a point-in-time snapshot of the bulletin as it stood at consolidation,
// not a live-syncing document. The caller's AI-estimated age/gender is shown here too (Epic 16 follow-up) since
// this is the one card guaranteed to render on every consolidated case, live or replayed — it previously only
// appeared in the live-call FactSheet, which disappears once a summary/bulletin exists, silently dropping it.
export default function BulletinCard({ incidentId, bulletin, callerEstimate }: { incidentId: string; bulletin: Bulletin; callerEstimate?: CallerEstimate }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bulletinText(incidentId, bulletin, callerEstimate))
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
        {callerEstimate && (
          <div className="bulletin-row">
            <dt>CALLER</dt>
            <dd>{callerEstimateText(callerEstimate)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
