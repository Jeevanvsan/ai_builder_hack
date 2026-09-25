import { useState, type FormEvent } from 'react'
import { addNote } from '../lib/responseActions'
import { useResponder } from '../lib/responderContext'
import ResponderNameDialog from './ResponderNameDialog'

export default function NoteForm({ incidentId }: { incidentId: string }) {
  const { name, setName } = useResponder()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askName, setAskName] = useState(false)

  const save = async (responder: string) => {
    setBusy(true)
    setError(null)
    try {
      await addNote(incidentId, responder, text.trim())
      setText('')
    } catch (e) {
      setError(`Couldn't save the note: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!name) return setAskName(true)
    void save(name)
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
      {askName && (
        <ResponderNameDialog
          initial={name}
          onClose={() => setAskName(false)}
          onSave={(n) => {
            setName(n)
            setAskName(false)
            void save(n)
          }}
        />
      )}
    </form>
  )
}
