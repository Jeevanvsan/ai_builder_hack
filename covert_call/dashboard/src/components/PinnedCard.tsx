import { motion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'

// Investigation-board wrapper for the existing .card content — every field/panel on the incident detail page is
// "evidence" pinned to the board the moment its data exists, materializing with a soft light-burst rather than a
// literal pin dropping in (see the plan's "VFX-style reveals, not literal cork-and-string" note). Layout stays
// on the same aligned CSS grid the rest of the page uses — no scatter, no rotation, per the user's explicit
// "perfectly aligned" requirement.
export default function PinnedCard({
  children,
  className = '',
  glowColor = 'var(--accent-glow)',
}: {
  children: ReactNode
  className?: string
  glowColor?: string
}) {
  return (
    <motion.div
      className={`card pinned-card ${className}`}
      style={{ '--pin-glow': glowColor } as CSSProperties}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.9 }}
    >
      <span className="pinned-card-glow" aria-hidden="true" />
      {children}
    </motion.div>
  )
}
