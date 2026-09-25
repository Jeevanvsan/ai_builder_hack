import { useEffect, useRef, useState } from 'react'
import { signOutResponder } from '../lib/auth'

export default function ResponderMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div className="responder-menu" ref={ref}>
      <button
        type="button"
        className="responder-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        On shift: <strong>{name}</strong>
      </button>
      {open && (
        <div className="responder-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="responder-menu-item"
            onClick={() => { setOpen(false); void signOutResponder() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
