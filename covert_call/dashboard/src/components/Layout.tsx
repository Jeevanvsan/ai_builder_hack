import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useResponder } from '../lib/responderContext'
import { useIncidentAlerts, type AlertPermission } from '../lib/useIncidentAlerts'
import IncidentToasts from './IncidentToasts'
import ResponderNameDialog from './ResponderNameDialog'

const alertLabel: Record<AlertPermission, string> = {
  default: 'Enable alerts',
  granted: 'Alerts on',
  denied: 'Notifications blocked',
  unsupported: 'Sound alerts',
}

export default function Layout() {
  const { name, setName } = useResponder()
  const [editing, setEditing] = useState(false)
  const alerts = useIncidentAlerts()

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">QB</span>
          <span className="brand-name">QuickBite</span>
          <span className="brand-sub">Monitoring Dashboard</span>
        </div>
        <div className="topbar-right">
          <nav className="nav">
            <NavLink to="/" end>Live queue</NavLink>
            <NavLink to="/history">Case history</NavLink>
          </nav>
          <button
            type="button"
            className={`alerts-toggle alerts-${alerts.permission}`}
            onClick={alerts.enable}
            title={alerts.permission === 'denied' ? 'Allow notifications for this site in your browser settings. Sound alerts still play.' : 'Plays a sound and shows a system notification when a new incident arrives'}
          >
            {alertLabel[alerts.permission]}
          </button>
          <button type="button" className="responder-chip" onClick={() => setEditing(true)}>
            {name ? <>On shift: <strong>{name}</strong></> : 'Set your name'}
          </button>
        </div>
      </header>
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
      {editing && (
        <ResponderNameDialog
          initial={name}
          onSave={(n) => { setName(n); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
