import type { Incident, Severity } from './types.ts'

const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }

// Combines what was said (urgency, danger indicators) with how it was said (voice stress).
export function deriveSeverity(fields: Incident['extractedFieldsLive'], voiceStress: number | null): Severity {
  const stress = voiceStress ?? 0
  // Weapons and immediately life-threatening signals (a gunshot, a scream, fire) force high severity regardless
  // of the caller's stated urgency — these often come from what the AI sees/hears (Epic 10), not what's said.
  const critical = fields.dangerIndicators.some((d) => /weapon|gun|firearm|knife|gunshot|scream|explosion|blast|fire|smoke|stab|blood/i.test(d))
  if (fields.urgency === 'high' || critical || stress >= 80) return 'high'
  if (fields.urgency === 'medium' || fields.dangerIndicators.length > 0 || stress >= 55) return 'medium'
  return 'low'
}

export const maxSeverity = (a: Severity, b: Severity): Severity => (rank[a] >= rank[b] ? a : b)
