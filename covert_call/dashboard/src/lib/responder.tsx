import { useState, type ReactNode } from 'react'
import { ResponderCtx } from './responderContext'

const STORAGE_KEY = 'qb-dashboard-responder'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

// Stand-in for real responder auth: the on-shift name is remembered per browser.
export function ResponderProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState(readStored)
  const setName = (next: string) => {
    setNameState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode etc.): the name still works for this session.
    }
  }
  return <ResponderCtx.Provider value={{ name, setName }}>{children}</ResponderCtx.Provider>
}
