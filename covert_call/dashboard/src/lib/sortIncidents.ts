import type { Incident } from '../../../shared/incidents/types'

// Sort options shared by the Live queue and Case history. The page's own default order (priority ranking /
// most recently resolved, or the AI search ranking) is used when `sort` is empty.
export const SORTS = {
  risk: 'Highest risk first',
  newest: 'Newest first',
  oldest: 'Oldest first',
  stress: 'Highest voice stress',
} as const
export type SortKey = keyof typeof SORTS

const SEV = { high: 2, medium: 1, low: 0 } as const
const started = (i: Incident) => Date.parse(i.sessionStartedAt) || 0

// Risk = severity, then how many danger signs, then voice stress, then newest.
function risk(i: Incident): number[] {
  return [SEV[i.severity] ?? 0, i.extractedFieldsLive.dangerIndicators.length, i.voiceStressScore ?? 0, started(i)]
}
function byTuple(a: number[], b: number[]): number {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return b[k] - a[k]
  return 0
}

export function sortIncidents(list: Incident[], sort: string): Incident[] {
  if (!(sort in SORTS)) return list
  const out = [...list]
  switch (sort as SortKey) {
    case 'risk': return out.sort((a, b) => byTuple(risk(a), risk(b)))
    case 'newest': return out.sort((a, b) => started(b) - started(a))
    case 'oldest': return out.sort((a, b) => started(a) - started(b))
    case 'stress': return out.sort((a, b) => (b.voiceStressScore ?? -1) - (a.voiceStressScore ?? -1) || started(b) - started(a))
  }
}
