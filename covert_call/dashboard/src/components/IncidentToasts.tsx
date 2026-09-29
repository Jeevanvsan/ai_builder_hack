import { Link } from 'react-router-dom'
import { channelLabel } from '../lib/format'
import type { Incident } from '../../../shared/incidents/types'

// Epic 16.9: a toast with `changeReason` set is a re-alert on an already-viewed incident that materially changed
// (address confirmed, a new danger indicator, urgency escalating) — distinct wording from a brand-new incident.
export type IncidentToast = Incident & { changeReason?: string }

export default function IncidentToasts({ toasts, onDismiss }: { toasts: IncidentToast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="toasts" role="region" aria-live="assertive" aria-label="New incident alerts">
      {toasts.map((t) => (
        <div key={t.id} className={t.changeReason ? 'toast toast-change' : 'toast'}>
          <span className="live-dot" />
          <div className="toast-body">
            <strong>{t.changeReason ? `Update on ${t.id}` : `New incident ${t.id}`}</strong>
            <span className="sub">{t.changeReason ?? `${channelLabel(t.channel)} just started`}</span>
          </div>
          <Link to={`/incident/${t.id}`} className="btn btn-primary btn-sm" onClick={() => onDismiss(t.id)}>Open</Link>
          <button type="button" className="toast-close" aria-label={`Dismiss alert for ${t.id}`} onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
