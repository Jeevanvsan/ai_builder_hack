import type { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <section>
        <div className="page-head">
          <h1>Admins only</h1>
          <p className="muted">This page is only available to responder admins.</p>
        </div>
      </section>
    )
  }
  return <>{children}</>
}
