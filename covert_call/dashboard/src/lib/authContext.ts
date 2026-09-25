import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
import type { Responder } from './responders'

type AuthState = {
  user: User | null
  responder: Responder | null
  loading: boolean
  isAdmin: boolean
}

export const AuthCtx = createContext<AuthState>({ user: null, responder: null, loading: true, isAdmin: false })

export const useAuth = () => useContext(AuthCtx)
