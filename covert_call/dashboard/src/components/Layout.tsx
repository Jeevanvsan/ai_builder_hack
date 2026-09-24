import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useResponder } from '../lib/responderContext'
import ResponderNameDialog from './ResponderNameDialog'

export default function Layout() {
  const { name, setName } = useResponder()
  const [editing, setEditing] = useState(false)

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
          <button type="button" className="responder-chip" onClick={() => setEditing(true)}>
            {name ? <>On shift: <strong>{name}</strong></> : 'Set your name'}
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
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
