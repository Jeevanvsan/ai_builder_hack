import { useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import { signIn } from '../lib/auth'

function friendlyError(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(e.code)) {
      return 'Incorrect email or password.'
    }
    if (e.code === 'auth/too-many-requests') return 'Too many attempts. Try again in a moment.'
  }
  return "Couldn't sign in. Try again."
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin-shell">
      <form className="signin-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">QB</span>
          <span className="brand-name">QuickBite</span>
        </div>
        <h1 className="signin-title">Monitoring Dashboard</h1>
        <p className="signin-sub">Sign in with your responder account.</p>

        <label className="field-label" htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />

        <label className="field-label" htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="action-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
