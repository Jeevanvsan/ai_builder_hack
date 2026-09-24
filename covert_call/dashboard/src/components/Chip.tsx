import type { ReactNode } from 'react'

export default function Chip({ tone, filled, children }: { tone: string; filled?: boolean; children: ReactNode }) {
  return <span className={`chip chip-${tone}${filled ? ' chip-filled' : ''}`}>{children}</span>
}
