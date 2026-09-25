import { useEffect, useState, type FormEvent } from 'react'
import Chip from '../../components/Chip'
import Modal from '../../components/Modal'
import { useAuth } from '../../lib/authContext'
import {
  addResponder,
  deleteResponder,
  updateResponder,
  watchResponders,
  type Responder,
  type ResponderRole,
} from '../../lib/responders'

function AddResponderForm({ onClose, createdBy }: { onClose: () => void; createdBy: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ResponderRole>('responder')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addResponder({ name: name.trim(), email: email.trim().toLowerCase(), role }, createdBy)
      setDone(true)
    } catch (err) {
      setError(`Couldn't add responder: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal title="Responder added to the roster" onClose={onClose} actions={<button type="button" className="btn btn-primary" onClick={onClose}>Done</button>}>
        <p>
          <strong>{name}</strong> ({email}) can now be attributed on incidents. They still need a sign-in account:
        </p>
        <ol className="steps-list">
          <li>Open the <a href="https://console.firebase.google.com/project/quickbite-5cde0/authentication/users" target="_blank" rel="noreferrer">Firebase Authentication console</a>.</li>
          <li>Click "Add user", using the exact same email: <span className="mono">{email}</span>.</li>
          <li>Set a password and share it with them.</li>
        </ol>
      </Modal>
    )
  }

  return (
    <Modal
      title="Add responder"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-responder-form" className="btn btn-primary" disabled={busy || !name.trim() || !email.trim()}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </>
      }
    >
      <form id="add-responder-form" onSubmit={submit}>
        <label className="field-label" htmlFor="responder-name">Name</label>
        <input id="responder-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={60} />

        <label className="field-label" htmlFor="responder-email">Email</label>
        <input id="responder-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label className="field-label" htmlFor="responder-role">Role</label>
        <select id="responder-role" className="input" value={role} onChange={(e) => setRole(e.target.value as ResponderRole)}>
          <option value="responder">Responder</option>
          <option value="admin">Admin</option>
        </select>

        {error && <p className="action-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

function EditResponderModal({ responder, onClose }: { responder: Responder; onClose: () => void }) {
  const [name, setName] = useState(responder.name)
  const [role, setRole] = useState<ResponderRole>(responder.role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateResponder(responder.email, { name: name.trim(), role })
      onClose()
    } catch (err) {
      setError(`Couldn't save changes: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Edit ${responder.email}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="edit-responder-form" className="btn btn-primary" disabled={busy || !name.trim()}>Save</button>
        </>
      }
    >
      <form id="edit-responder-form" onSubmit={submit}>
        <label className="field-label" htmlFor="edit-responder-name">Name</label>
        <input id="edit-responder-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={60} />

        <label className="field-label" htmlFor="edit-responder-role">Role</label>
        <select id="edit-responder-role" className="input" value={role} onChange={(e) => setRole(e.target.value as ResponderRole)}>
          <option value="responder">Responder</option>
          <option value="admin">Admin</option>
        </select>

        {error && <p className="action-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

function ConfirmDeleteModal({ responder, onClose }: { responder: Responder; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteResponder(responder.email)
      onClose()
    } catch (err) {
      setError(`Couldn't remove responder: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Remove ${responder.email}?`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>Remove</button>
        </>
      }
    >
      <p>They immediately lose dashboard access. This only removes the roster entry — if they still have a Firebase sign-in account, remove it separately from the Authentication console.</p>
      {error && <p className="action-error" role="alert">{error}</p>}
    </Modal>
  )
}

export default function ResponderManagementPage() {
  const { user } = useAuth()
  const [responders, setResponders] = useState<Responder[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Responder | null>(null)
  const [deleting, setDeleting] = useState<Responder | null>(null)

  useEffect(() => watchResponders((r) => { setResponders(r); setLoading(false) }), [])

  const toggleStatus = (r: Responder) => {
    void updateResponder(r.email, { status: r.status === 'active' ? 'disabled' : 'active' })
  }

  const sorted = [...responders].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section>
      <div className="page-head">
        <h1>Responder management</h1>
        <p className="muted">Add, edit, disable or remove dashboard responders. Admins-only.</p>
      </div>

      <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add responder</button>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table queue" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.email}>
                <td>{r.name}</td>
                <td className="mono">{r.email}</td>
                <td><Chip tone={r.role === 'admin' ? 'high' : 'low'}>{r.role}</Chip></td>
                <td><Chip tone={r.status === 'active' ? 'live' : 'danger'} filled>{r.status}</Chip></td>
                <td className="nowrap">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(r)}>Edit</button>{' '}
                  <button type="button" className="btn btn-sm" onClick={() => toggleStatus(r)}>
                    {r.status === 'active' ? 'Disable' : 'Enable'}
                  </button>{' '}
                  <button type="button" className="btn btn-sm" onClick={() => setDeleting(r)} disabled={r.email === user?.email}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && user?.email && <AddResponderForm onClose={() => setAdding(false)} createdBy={user.email} />}
      {editing && <EditResponderModal responder={editing} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDeleteModal responder={deleting} onClose={() => setDeleting(null)} />}
    </section>
  )
}
