import { useState, type ReactNode } from 'react'

// Re-keying on the value restarts the highlight each time the field changes; the value shown on first render doesn't flash.
export default function LiveValue({ value, children }: { value: unknown; children: ReactNode }) {
  const key = JSON.stringify(value)
  const [initialKey] = useState(key)
  return (
    <span key={key} className={key !== initialKey ? 'live-value' : undefined}>
      {children}
    </span>
  )
}
