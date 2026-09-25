import { useState, type FormEvent } from 'react'
import Modal from './Modal'

export default function ResponderNameDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed) onSave(trimmed)
  }

  return (
    <Modal
      title="Who's on shift?"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="responder-name-form" className="btn btn-primary" disabled={!trimmed}>Save</button>
        </>
      }
    >
      <form id="responder-name-form" onSubmit={submit}>
        <label className="field-label" htmlFor="responder-name">Your name, shown on incidents you act on</label>
        <input
          id="responder-name"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Responder A"
          autoFocus
          maxLength={40}
        />
      </form>
    </Modal>
  )
}
