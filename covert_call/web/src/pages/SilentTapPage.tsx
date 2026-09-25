import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/disguise/PageHeader'
import { db } from '../lib/firebase'
import { zeroTraceExit } from '../lib/gemini/exit'
import { startIncident, updateLiveFields, confirmAddress } from '../../../shared/incidents/client.ts'
import type { Severity } from '../../../shared/incidents/types.ts'

// Each visible option is an ordinary "delivery instruction" — its real meaning only appears on long-press, so
// nothing here relies on the caller having memorized anything before opening this screen (same design intent as
// the live-teaching rule for the call flow, applied to a silent/no-audio context instead of speech).
type Option = {
  id: string
  label: string
  realMeaning: string
  indicator?: string
  urgency?: Severity
}

const OPTIONS: Option[] = [
  { id: 'ring-bell', label: 'Ring the bell', realMeaning: "Everything's fine right now" },
  { id: 'leave-door', label: 'Leave at the door', realMeaning: 'I need help but no immediate danger — low urgency', urgency: 'low' },
  { id: 'call-on-arrival', label: 'Call on arrival', realMeaning: 'Someone else is with me and may be a threat', indicator: 'aggressor present', urgency: 'medium' },
  { id: 'fragile', label: 'Handle with care — fragile', realMeaning: 'Someone is injured', indicator: 'injury', urgency: 'medium' },
  { id: 'no-contact', label: "Don't ring, leave silently", realMeaning: 'A weapon is present — send help urgently', indicator: 'weapon mentioned', urgency: 'high' },
]

function OptionButton({ option, onSelect, selected }: { option: Option; onSelect: () => void; selected: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPress = useCallback(() => {
    timerRef.current = setTimeout(() => setRevealed(true), 500)
  }, [])
  const endPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRevealed(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <button
      type="button"
      className={`tap-option${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
    >
      <span className="tap-option-label">{option.label}</span>
      {revealed && <span className="tap-option-meaning">{option.realMeaning}</span>}
    </button>
  )
}

export function SilentTapPage() {
  const navigate = useNavigate()
  const incidentIdRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void startIncident(db, { channel: 'silent-tap' }).then(({ id }) => {
      incidentIdRef.current = id
      setReady(true)
    })
  }, [])

  const toggleOption = (option: Option) => {
    const id = incidentIdRef.current
    if (!id) return
    const next = new Set(selected)
    if (next.has(option.id)) next.delete(option.id)
    else next.add(option.id)
    setSelected(next)

    const chosen = OPTIONS.filter((o) => next.has(o.id))
    const dangerIndicators = chosen.map((o) => o.indicator).filter((v): v is string => Boolean(v))
    const urgencies = chosen.map((o) => o.urgency).filter((v): v is Severity => Boolean(v))
    const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }
    const urgency = urgencies.length ? urgencies.reduce((a, b) => (rank[a] >= rank[b] ? a : b)) : null

    void updateLiveFields(db, id, { dangerIndicators, urgency })
  }

  const submit = async () => {
    const id = incidentIdRef.current
    if (!id) return
    if (note.trim()) await updateLiveFields(db, id, { notes: note.trim() })
    if (address.trim()) await confirmAddress(db, id, address.trim())
    zeroTraceExit(db, id, navigate)
  }

  return (
    <div className="page page-sub">
      <PageHeader title="Delivery instructions" subtitle="Help our rider find you" backTo="/" />

      <section className="card">
        <h2 className="card-title">Any special instructions?</h2>
        <p className="tap-hint">Tap to select. Press and hold any option to see more detail.</p>
        <div className="tap-options">
          {OPTIONS.map((option) => (
            <OptionButton key={option.id} option={option} selected={selected.has(option.id)} onSelect={() => toggleOption(option)} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Delivery address</h2>
        <input
          className="tap-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Confirm your address"
        />
      </section>

      <section className="card">
        <h2 className="card-title">Note for rider</h2>
        <textarea
          className="tap-input tap-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else the rider should know"
          rows={3}
        />
      </section>

      <div className="bottom-bar">
        <button type="button" className="checkout-bar" disabled={!ready} onClick={() => void submit()}>
          <span className="cart-bar-cta">Save instructions</span>
        </button>
      </div>
    </div>
  )
}
