import { Link } from 'react-router-dom'
import { channelLabel } from '../lib/format'
import type { Incident } from '../../../shared/incidents/types'

export default function IncidentToasts({ toasts, onDismiss }: { toasts: Incident[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="toasts" role="region" aria-live="assertive" aria-label="New incident alerts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="live-dot" />
          <div className="toast-body">
            <strong>New incident {t.id}</strong>
            <span className="sub">{channelLabel(t.channel)} just started</span>
          </div>
          <Link to={`/incident/${t.id}`} className="btn btn-primary btn-sm" onClick={() => onDismiss(t.id)}>Open</Link>
          <button type="button" className="toast-close" aria-label={`Dismiss alert for ${t.id}`} onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
