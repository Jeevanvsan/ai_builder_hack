import { useState } from 'react'
import { acknowledge, AlreadyClaimedError, resolve, startResponse } from '../lib/responseActions'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import type { Incident } from '../../../shared/incidents/types'
import Modal from './Modal'

type Action = 'acknowledge' | 'start' | 'resolve'

export default function ResponseActions({ incident }: { incident: Incident }) {
  const { user, responder } = useAuth()
  const name = responderLabel(user, responder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmResolve, setConfirmResolve] = useState(false)
  const status = incident.response.status

  const run = async (action: Action, responderName: string) => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'acknowledge') await acknowledge(incident.id, responderName)
      if (action === 'start') await startResponse(incident.id)
      if (action === 'resolve') await resolve(incident.id, incident.callState === 'active')
    } catch (e) {
      setError(e instanceof AlreadyClaimedError ? e.message : `Couldn't update the incident: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const request = (action: Action) => {
    if (action === 'resolve') return setConfirmResolve(true)
    void run(action, name)
  }

  if (status === 'resolved') {
    return <div className="response-actions"><span className="resolved-note">Resolved</span></div>
  }

  return (
    <div className="response-actions">
      <div className="response-buttons">
        {status === 'new' && (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => request('acknowledge')}>
            Acknowledge
          </button>
        )}
        {status === 'acknowledged' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => request('start')}>
            Start response
          </button>
        )}
        {(status === 'acknowledged' || status === 'in_progress') && (
          <button type="button" className="btn" disabled={busy} onClick={() => request('resolve')}>
            Resolve
          </button>
        )}
      </div>
      {error && <p className="action-error" role="alert">{error}</p>}

      {confirmResolve && (
        <Modal
          title={`Resolve ${incident.id}?`}
          onClose={() => setConfirmResolve(false)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setConfirmResolve(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirmResolve(false)
                  void run('resolve', name)
                }}
              >
                Resolve incident
              </button>
            </>
          }
        >
          <p>It leaves the live queue and moves to case history for every responder.</p>
          {incident.callState === 'active' && (
            <p className="modal-warning">The call is still live. Resolving will also mark the call as ended on the dashboard.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
