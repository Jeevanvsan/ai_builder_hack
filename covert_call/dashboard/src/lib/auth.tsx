import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { AuthCtx } from './authContext'
import { ensureBootstrapAdmin, getResponder, type Responder } from './responders'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [responder, setResponder] = useState<Responder | null>(null)
  const [loading, setLoading] = useState(true)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setBlockedReason(null)
    if (!u || !u.email) {
      setUser(u)
      setResponder(null)
      setLoading(false)
      return
    }
    try {
      await ensureBootstrapAdmin(u)
      const snap = await getResponder(u.email)
      const doc = snap.exists() ? (snap.data() as Responder) : null
      if (!doc || doc.status !== 'active') {
        setBlockedReason(doc ? 'Your access has been disabled. Contact an admin.' : "Your account isn't set up as a responder yet. Contact an admin.")
        await signOut(auth)
        setUser(null)
        setResponder(null)
        setLoading(false)
        return
      }
      setUser(u)
      setResponder(doc)
    } catch {
      setBlockedReason("Couldn't verify your responder access. Try again.")
      await signOut(auth)
      setUser(null)
      setResponder(null)
    } finally {
      setLoading(false)
    }
  }), [])

  const isAdmin = responder?.role === 'admin'

  return (
    <AuthCtx.Provider value={{ user, responder, loading, isAdmin }}>
      {blockedReason && !user && <BlockedBanner message={blockedReason} onDismiss={() => setBlockedReason(null)} />}
      {children}
    </AuthCtx.Provider>
  )
}

// Shown once, above the sign-in screen, when onAuthStateChanged force-signs someone out.
function BlockedBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="auth-blocked-banner" role="alert">
      {message}
      <button type="button" className="btn btn-sm" onClick={onDismiss}>Dismiss</button>
    </div>
  )
}

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signOutResponder() {
  return signOut(auth)
}

// Shown on incidents/notes: prefer the responder's display name over the raw email.
export function responderLabel(user: User | null, responder?: Responder | null): string {
  if (responder?.name) return responder.name
  if (!user) return ''
  return user.email?.split('@')[0] ?? user.uid
}
