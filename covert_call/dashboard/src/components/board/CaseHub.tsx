import type { Ref } from 'react'
import type { Severity } from '../../../../shared/incidents/types'
import DecodeText from './DecodeText'

// The case hub sits on the incident pin at the centre of the board: a ring around the pin (the pin stays visible
// inside it) whose aura carries severity, plus a plate with severity and call state. Every evidence tile links here.
export default function CaseHub({
  severity,
  live,
  timer,
  hubRef,
}: {
  severity: Severity
  live: boolean
  timer: string
  hubRef?: Ref<HTMLDivElement>
}) {
  return (
    <div className={`case-hub hub-${severity}${live ? ' hub-live' : ''}`}>
      <div className="hub-ring" ref={hubRef}>
        <span className="hub-ring-inner" />
      </div>
      <div className="hub-plate">
        <DecodeText text={severity.toUpperCase()} className="hub-severity" />
        <span className="hub-state">
          {live ? <><span className="live-dot" />LIVE {timer}</> : <>Case record · {timer}</>}
        </span>
      </div>
    </div>
  )
}
