import { useState, type FormEvent } from 'react'
import { addNote } from '../lib/responseActions'
import { useAuth } from '../lib/authContext'
import { responderLabel } from '../lib/auth'

export default function NoteForm({ incidentId }: { incidentId: string }) {
  const { user, responder } = useAuth()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addNote(incidentId, responderLabel(user, responder), text.trim())
      setText('')
    } catch (e) {
      setError(`Couldn't save the note: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="note-form" onSubmit={submit}>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note for the team, e.g. unit dispatched"
        maxLength={280}
        aria-label="Add a note"
      />
      <button type="submit" className="btn" disabled={busy || !text.trim()}>Add note</button>
      {error && <p className="action-error" role="alert">{error}</p>}
    </form>
  )
}
