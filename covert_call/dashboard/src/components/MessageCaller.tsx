import { useEffect, useState } from 'react'
import { sendResponderMessage, subscribeResponderMessages } from '../../../shared/incidents/client.ts'
import type { ResponderMessage } from '../../../shared/incidents/types.ts'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'
import { db } from '../lib/firebase'
import { formatTime } from '../lib/format'

// Epic 23: send the caller a short instruction through Mia, who passes it on as ordinary delivery chat on her
// next turn and reports the exact words she used.
const QUICK = ['Stay hidden, help is on the way', 'Help is about 5 minutes away', 'Move to a busy, public place', 'Stay on the line']

export default function MessageCaller({ incidentId, live }: { incidentId: string; live: boolean }) {
  const { user, responder } = useAuth()
  const [messages, setMessages] = useState<ResponderMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeResponderMessages(db, incidentId, setMessages), [incidentId])

  const send = async (value: string) => {
    const t = value.trim()
    if (!t || sending) return
    setSending(true)
    setError(null)
    try {
      await sendResponderMessage(db, incidentId, t, responderLabel(user, responder))
      setText('')
    } catch {
      setError("Couldn't send the message. Try again.")
    } finally {
      setSending(false)
    }
  }

  if (!live && messages.length === 0) return null

  return (
    <div className="message-caller">
      <div className="message-head">
        <span className="critical-title">Message caller via Mia</span>
        <span className="muted">Mia rephrases it as delivery chat, so the disguise holds.</span>
      </div>
      {live && (
        <>
          <div className="message-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" className="mc-chip" disabled={sending} onClick={() => void send(q)}>{q}</button>
            ))}
          </div>
          <form className="message-form" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder='e.g. "Stay inside, police are 3 minutes away"' />
            <button type="submit" className="mc-send" disabled={sending || !text.trim()}>Send</button>
          </form>
          {error && <p className="message-error">{error}</p>}
        </>
      )}
      {messages.length > 0 && (
        <ul className="message-list">
          {messages.map((m) => (
            <li key={m.id}>
              <div><b>{m.text}</b> <span className="muted">· {m.sentBy}, {formatTime(m.sentAt)}</span></div>
              {m.status === 'delivered'
                ? <div className="message-delivered">✓ Delivered: “{m.spokenAs}”</div>
                : <div className="muted">{live ? 'Waiting for a pause in the call…' : 'Not delivered (call ended)'}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
