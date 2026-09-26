import { motion } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import type { Evidence } from '../../lib/evidence'
import BoardIcon from './BoardIcon'
import DecodeText from './DecodeText'

// One piece of evidence on the board. Materializes with a spring (Motion) the moment its data exists; values decode
// in; while an AI step behind it is still running it shows a searching shimmer instead of a value.
export default function EvidenceTile({
  evidence,
  elRef,
  slot,
  children,
}: {
  evidence: Evidence
  elRef?: Ref<HTMLDivElement>
  slot: string
  children?: ReactNode
}) {
  const { kind, label, values, sub, tone, pending } = evidence
  return (
    <motion.div
      ref={elRef}
      className={`evidence-tile tone-${tone} slot-${slot}${pending ? ' is-pending' : ''}`}
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    >
      <div className="evidence-head">
        <span className="evidence-icon"><BoardIcon name={kind} /></span>
        <span className="evidence-label">{label}</span>
      </div>
      {children ?? (
        <div className="evidence-values">
          {values.map((v) => <DecodeText key={v} text={v} className="evidence-value" />)}
        </div>
      )}
      {sub && <DecodeText text={sub} className="evidence-sub" />}
      {pending && (
        <div className="evidence-searching" role="status">
          <span className="searching-bar" />
          <span className="searching-label">{pending}</span>
        </div>
      )}
    </motion.div>
  )
}
