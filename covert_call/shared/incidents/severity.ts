import type { Incident, Severity } from './types.ts'

const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }

// Danger tags are free text from the model and are often negative ("No weapon involved", "No injury"). Keyword
// checks matched the danger word and ignored the "No", so a call with no weapon was shown as armed and got a
// "weapon reported" recommendation. Every keyword check on dangerIndicators goes through affirmed() first.
const NEGATED = /\b(no|not|none|without|never|zero|unarmed)\b[^,;|]{0,24}\b(weapons?|guns?|firearms?|knife|knives|armed|injur\w*|hurt|blood|bleed\w*|harm\w*|fire|smoke|stab\w*)\b|\b(weapons?|injur\w*|fire)\s*[:-]\s*(none|no)\b|\bunarmed\b/i
export const isNegatedIndicator = (d: string) => NEGATED.test(d)
export const affirmed = (indicators: string[]) => indicators.filter((d) => !isNegatedIndicator(d))

// Combines what was said (urgency, danger indicators) with how it was said (voice stress).
export function deriveSeverity(fields: Incident['extractedFieldsLive'], voiceStress: number | null): Severity {
  const stress = voiceStress ?? 0
  const danger = affirmed(fields.dangerIndicators)
  // Weapons and immediately life-threatening signals (a gunshot, a scream, fire) force high severity regardless
  // of the caller's stated urgency — these often come from what the AI sees/hears (Epic 10), not what's said.
  const critical = danger.some((d) => /weapon|gun|firearm|knife|gunshot|scream|explosion|blast|fire|smoke|stab|blood/i.test(d))
  if (fields.urgency === 'high' || critical || stress >= 80) return 'high'
  if (fields.urgency === 'medium' || danger.length > 0 || stress >= 55) return 'medium'
  return 'low'
}

export const maxSeverity = (a: Severity, b: Severity): Severity => (rank[a] >= rank[b] ? a : b)

// One derived, human-readable recommended action (Epic 16.3) — deterministic and explainable from the same
// inputs deriveSeverity() uses, so a responder gets a clear next step instead of having to interpret a chip.
export function deriveRecommendation(fields: Incident['extractedFieldsLive'], severity: Severity): string {
  const danger = affirmed(fields.dangerIndicators)
  const weapon = danger.some((d) => /weapon|gun|firearm|knife/i.test(d))
  const fireOrInjury = danger.some((d) => /fire|smoke|blood|injur|stab|gunshot|explosion|blast/i.test(d))
  if (weapon) return 'Recommend immediate police dispatch — weapon reported'
  if (fireOrInjury) return 'Recommend immediate police + medical dispatch — injury or hazard reported'
  if (severity === 'high') return 'Recommend immediate dispatch'
  if (severity === 'medium') return 'Recommend monitoring closely — dispatch if the situation escalates'
  return 'Recommend monitoring, no immediate dispatch needed'
}

// Builds one short reasoning-trace line for a severity/urgency change (Epic 16.1) — called only when the value
// actually changed, not on every field write, so the trace stays a meaningful log of escalation, not noise.
export function describeSeverityChange(
  from: Severity,
  to: Severity,
  fields: Incident['extractedFieldsLive'],
  voiceStress: number | null,
): string {
  const reasons: string[] = []
  if (fields.urgency === 'high' || fields.urgency === 'medium') reasons.push(`urgency reported ${fields.urgency}`)
  const lastIndicator = fields.dangerIndicators.at(-1)
  if (lastIndicator) reasons.push(`"${lastIndicator}" reported`)
  if (voiceStress !== null && voiceStress >= 55) reasons.push(`voice stress at ${voiceStress}`)
  const why = reasons.length ? reasons.join(', ') : 'new information reported'
  return `Severity raised ${from.toUpperCase()} → ${to.toUpperCase()} — ${why}`
}
