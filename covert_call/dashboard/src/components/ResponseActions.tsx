import { useState } from 'react'
import { acknowledge, AlreadyClaimedError, resolve, startResponse } from '../lib/responseActions'
import { useResponder } from '../lib/responderContext'
import type { Incident } from '../lib/types'
import Modal from './Modal'
import ResponderNameDialog from './ResponderNameDialog'

type Action = 'acknowledge' | 'start' | 'resolve'

export default function ResponseActions({ incident }: { incident: Incident }) {
  const { name, setName } = useResponder()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askName, setAskName] = useState<Action | null>(null)
  const [confirmResolve, setConfirmResolve] = useState(false)
  const status = incident.response.status

  const run = async (action: Action, responder: string) => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'acknowledge') await acknowledge(incident.id, responder)
      if (action === 'start') await startResponse(incident.id)
      if (action === 'resolve') await resolve(incident.id)
    } catch (e) {
      setError(e instanceof AlreadyClaimedError ? e.message : `Couldn't update the incident: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  // Every action needs a responder name first, so the record shows who acted.
  const request = (action: Action) => {
    if (!name) return setAskName(action)
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

      {askName && (
        <ResponderNameDialog
          initial={name}
          onClose={() => setAskName(null)}
          onSave={(n) => {
            setName(n)
            const action = askName
            setAskName(null)
            if (action === 'resolve') setConfirmResolve(true)
            else void run(action, n)
          }}
        />
      )}

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
        </Modal>
      )}
    </div>
  )
}
