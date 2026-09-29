import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CriticalAlert } from '../lib/useIncidentAlerts'
import { acknowledge } from '../lib/responseActions'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import Modal from './Modal'

// Breaks through do-not-disturb for life-threatening developments (gunfire, weapon, break-in, caller gone silent
// after danger), with the actions a responder needs right then instead of a toast they might miss.
export default function CriticalAlerts({ alerts, onDismiss }: { alerts: CriticalAlert[]; onDismiss: (id: string) => void }) {
  const navigate = useNavigate()
  const { user, responder } = useAuth()
  const [working, setWorking] = useState(false)
  const current = alerts[0]
  if (!current) return null
  const i = current.incident
  const station = i.safeRoute?.destination
  const place = i.location.confirmed?.address ?? 'location not confirmed yet'
  const open = () => { onDismiss(i.id); navigate(`/incident/${i.id}`) }
  const ack = async () => {
    setWorking(true)
    try { await acknowledge(i.id, responderLabel(user, responder)) } catch { /* someone else already claimed it */ }
    setWorking(false)
    open()
  }

  return (
    <Modal
      title={`Critical — ${i.id}`}
      onClose={() => onDismiss(i.id)}
      actions={(
        <>
          <button type="button" className="btn" onClick={() => onDismiss(i.id)}>Dismiss</button>
          {station?.phone && <a className="btn" href={`tel:${station.phone}`}>Call {station.name}</a>}
          <button type="button" className="btn" onClick={open}>{i.audioListen?.status === 'live' ? 'Open & listen live' : 'Open case'}</button>
          {i.response.status === 'new' && <button type="button" className="btn btn-primary" disabled={working} onClick={() => void ack()}>Acknowledge & dispatch</button>}
        </>
      )}
    >
      <p className="critical-reason">{current.reason}</p>
      <dl className="fact-sheet">
        <div><dt>Where</dt><dd>{place}</dd></div>
        {i.recommendation && <div><dt>AI recommends</dt><dd>{i.recommendation}</dd></div>}
        {station && <div><dt>Nearest {station.kind}</dt><dd>{station.name}</dd></div>}
        <div><dt>Call</dt><dd>{i.callState === 'active' ? 'Still live' : 'Ended'}</dd></div>
      </dl>
      {alerts.length > 1 && <p className="sub">{alerts.length - 1} more critical alert{alerts.length > 2 ? 's' : ''} waiting.</p>}
    </Modal>
  )
}
