import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import { useIncidentAlerts, type AlertPermission } from '../lib/useIncidentAlerts'
import { useNextUrgentHotkey } from '../lib/useNextUrgentHotkey'
import IncidentToasts from './IncidentToasts'
import ResponderMenu from './ResponderMenu'

const alertLabel: Record<AlertPermission, string> = {
  default: 'Enable alerts',
  granted: 'Alerts on',
  denied: 'Notifications blocked',
  unsupported: 'Sound alerts',
}

export default function Layout() {
  const { user, responder, isAdmin } = useAuth()
  const alerts = useIncidentAlerts()
  useNextUrgentHotkey()

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">QB</span>
          <span className="brand-name">QuickBite</span>
          <span className="brand-sub">Monitoring Dashboard</span>
        </div>
        <div className="topbar-right">
          <button
            type="button"
            className={`alerts-toggle alerts-${alerts.permission}`}
            onClick={alerts.enable}
            title={alerts.permission === 'denied' ? 'Allow notifications for this site in your browser settings. Sound alerts still play.' : 'Plays a sound and shows a system notification when a new incident arrives'}
          >
            {alertLabel[alerts.permission]}
          </button>
          <span className="hotkey-hint" title="Jumps to the most urgent open incident">Press <kbd>N</kbd> for next urgent</span>
          <ResponderMenu name={responderLabel(user, responder)} />
        </div>
      </header>
      <nav className="subnav">
        <NavLink to="/" end>Live queue</NavLink>
        <NavLink to="/history">Case history</NavLink>
        <NavLink to="/analytics">Analytics</NavLink>
        {isAdmin && <NavLink to="/admin/responders">Responder management</NavLink>}
        {isAdmin && <NavLink to="/admin/performance">Responder performance</NavLink>}
      </nav>
      {alerts.soundBlocked && (
        <button type="button" className="sound-banner" onClick={alerts.enable}>
          <span className="live-dot" />
          Sound is off. Click anywhere to hear incident alerts.
        </button>
      )}
      <main className="content">
        <Outlet />
      </main>
      <IncidentToasts toasts={alerts.toasts} onDismiss={alerts.dismiss} />
    </div>
  )
}
