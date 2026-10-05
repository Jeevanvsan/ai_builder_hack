import { useEffect, useRef, useState } from 'react'
import type { Incident } from '../../../../shared/incidents/types'
import { assessCredibility, credibilityAvailable, loadCallerHistory, saveCredibility, saveOutcome, type CallerHistory } from '../../lib/credibility'

// Epic 31, in the Case file tab: who called (verified number or just a device), how often this device has called,
// the AI credibility check, and the responder's own verdict. The check runs once when the call ends; it is advice
// only, so nothing here ever closes or downgrades the case.

const LEVEL_LABEL = { 'likely-genuine': 'Likely genuine', uncertain: 'Uncertain', 'possible-false': 'Possible false call' } as const
const OUTCOMES: { id: NonNullable<Incident['response']['outcome']>; label: string }[] = [
  { id: 'genuine', label: 'Genuine' },
  { id: 'false-alarm', label: 'False alarm' },
  { id: 'prank', label: 'Prank' },
]

export default function CallerCheck({ incident, live }: { incident: Incident; live: boolean }) {
  const [history, setHistory] = useState<CallerHistory | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => { void loadCallerHistory(incident).then(setHistory) }, [incident.id, incident.callerUid]) // eslint-disable-line react-hooks/exhaustive-deps

  const check = async () => {
    setChecking(true); setError(null)
    try {
      await saveCredibility(incident.id, await assessCredibility(incident, history))
    } catch {
      setError("Couldn't run the check. Try again.")
    } finally { setChecking(false) }
  }

  // Run once automatically when the call has ended and there is no check yet.
  useEffect(() => {
    if (live || incident.credibility || ran.current || !credibilityAvailable || incident.callState !== 'ended') return
    ran.current = true
    void check()
  }, [live, incident.callState, incident.credibility, history]) // eslint-disable-line react-hooks/exhaustive-deps

  const c = incident.credibility
  const outcome = incident.response.outcome ?? null

  return (
    <section className="case-section caller-check">
      <h3>Caller check</h3>
      <dl className="fact-sheet">
        <div><dt>Caller</dt><dd>{history?.phone ? <>{history.phone} <span className="cc-ok">verified</span></> : incident.callerUid ? 'Unverified device' : 'No device id (older app)'}</dd></div>
        {history && (
          <div>
            <dt>This device</dt>
            <dd>
              {history.previousCalls === 0 ? 'First call' : `${history.previousCalls} earlier call${history.previousCalls > 1 ? 's' : ''} (${history.callsLast24h} in 24 h)`}
              {history.markedFalse > 0 && <span className="cc-warn"> · {history.markedFalse} marked false</span>}
            </dd>
          </div>
        )}
      </dl>

      <div className="cc-ai">
        <div className="cc-head">
          <span className="cc-title">AI credibility</span>
          {c && <span className={`cc-badge cc-${c.level}`}>{LEVEL_LABEL[c.level]} · {c.score}</span>}
          {credibilityAvailable && !live && (
            <button type="button" className="btn btn-sm" disabled={checking} onClick={() => void check()}>{checking ? 'Checking…' : c ? 'Re-check' : 'Check'}</button>
          )}
        </div>
        {live && !c && <p className="panel-empty">Runs when the call ends.</p>}
        {c && <ul className="cc-reasons">{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {error && <p className="message-error">{error}</p>}
        <p className="sub">Advice only. It never closes or downgrades a case; you decide.</p>
      </div>

      <div className="cc-outcome">
        <span className="sub">Your finding</span>
        {OUTCOMES.map((o) => (
          <button key={o.id} type="button" className={`mc-chip${outcome === o.id ? ' on' : ''}`} onClick={() => void saveOutcome(incident, outcome === o.id ? null : o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}
