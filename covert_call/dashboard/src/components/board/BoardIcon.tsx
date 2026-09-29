import type { EvidenceKind } from '../../lib/evidence'
import type { TimelineKind } from '../../lib/timeline'

type IconName = EvidenceKind | TimelineKind | 'escalation'

// One small stroke-icon set for the board (tiles + timeline rail), so every glyph shares a visual language.
const PATHS: Record<IconName, string> = {
  vehicle: 'M5 16h14l-1.5-5.5A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.5L5 16Zm0 0v2m14-2v2M7.5 16a1.5 1.5 0 1 0 0 .01M16.5 16a1.5 1.5 0 1 0 0 .01',
  location: 'M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  subjects: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8a5 5 0 0 1 10 0m2-8a2.5 2.5 0 1 0 0-5m1.5 13a4.5 4.5 0 0 0-3-4.2',
  threat: 'M12 4 3 19h18L12 4Zm0 6v4m0 3v.01',
  stress: 'M3 12h3l2-5 4 10 3-7 2 2h4',
  seen: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  nearby: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm0 5v6m-3-3h6',
  linked: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  start: 'M8 5v14l11-7L8 5Z',
  address: 'M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10Zm-2-10 1.5 1.5L14.5 9',
  ack: 'M5 12.5 10 17l9-10',
  end: 'M7 7h10v10H7z',
  resolved: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-6',
  note: 'M6 4h9l3 3v13H6V4Zm3 6h6m-6 4h6',
  advice: 'M4 5h16v11H9l-5 4V5Z',
  observed: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  escalation: 'M12 3 21 12 12 21 3 12 12 3Z',
}

export default function BoardIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
