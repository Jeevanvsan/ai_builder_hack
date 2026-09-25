import type { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'
import SignInPage from '../pages/SignInPage'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="auth-loading">Loading…</div>
  if (!user) return <SignInPage />
  return <>{children}</>
}
