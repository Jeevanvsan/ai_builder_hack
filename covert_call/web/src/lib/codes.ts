// Single source of truth for QuickBite's coded meanings (backlog Epic 8, Story 8.1).
//
// The same table drives three things so they can never drift apart:
//   1. the live-call persona's coded menu choices (persona.ts builds its Step 4 lists from here),
//   2. the "click & order" path — menu items reference a code id and the cart is decoded at checkout,
//   3. the long-press "real meaning" hint shown on a coded menu item.
//
// Each entry maps an ordinary food phrase to what it really reports. Kept plain data, no logic, so both the
// prompt text and the app read the exact same wording. Indicator strings are written the way a responder should
// read them, and are what the dashboard's deriveSeverity() inspects (e.g. it treats anything matching /weapon/i
// as high severity), so keep the responder-facing phrasing here.

import type { Severity } from '../../../shared/incidents/types.ts'

export type CodeScope = 'self' | 'other'

export interface Code {
  id: string
  scope: CodeScope
  // Lowercase food phrase as the persona speaks it ("extra pepperoni").
  food: string
  // Title-case label as it appears on a menu item/add-on ("Extra Pepperoni").
  menuLabel: string
  // The real meaning — spoken by the persona in the same breath, and shown on long-press in the app.
  meaning: string
  // Responder-facing danger tag written into the incident.
  indicator: string
  urgency: Severity
}

// "For yourself" — the person ordering is the one in trouble.
export const SELF_CODES: Code[] = [
  { id: 'weapon', scope: 'self', food: 'extra pepperoni', menuLabel: 'Extra Pepperoni', meaning: 'someone near you has a weapon', indicator: 'weapon present', urgency: 'high' },
  { id: 'harmed-now', scope: 'self', food: 'extra spicy', menuLabel: 'Extra Spicy', meaning: 'someone is hurting or threatening you right now', indicator: 'victim being harmed now', urgency: 'high' },
  { id: 'followed', scope: 'self', food: 'garlic bread on the side', menuLabel: 'Cheesy Garlic Bread', meaning: 'someone is following or chasing you', indicator: 'being followed or chased', urgency: 'high' },
  { id: 'taken', scope: 'self', food: 'packed to go', menuLabel: 'Sealed To-Go Box', meaning: 'you are being taken somewhere against your will', indicator: 'possible abduction', urgency: 'high' },
  { id: 'confined', scope: 'self', food: 'extra cheese', menuLabel: 'Extra Cheese', meaning: 'you are locked in or not being allowed to leave', indicator: 'confined against will', urgency: 'high' },
  { id: 'injured', scope: 'self', food: 'extra napkins', menuLabel: 'Extra Napkins', meaning: 'you are hurt and need medical help', indicator: 'injury - needs medical help', urgency: 'high' },
  { id: 'domestic', scope: 'self', food: 'a dessert', menuLabel: 'Choco Lava Cake', meaning: 'a family member or partner at home is hurting you', indicator: 'domestic abuse', urgency: 'high' },
]

// "For someone else" — the person is reporting something happening to others or around them.
export const OTHER_CODES: Code[] = [
  { id: 'crime-witnessed', scope: 'other', food: 'family combo', menuLabel: 'Family Combo — Large', meaning: 'you saw a crime, like a theft, assault or drug dealing', indicator: 'crime witnessed', urgency: 'medium' },
  { id: 'group-fight', scope: 'other', food: 'party platter', menuLabel: 'Party Platter', meaning: 'a group or gang, or a big fight', indicator: 'group violence / large fight', urgency: 'high' },
  { id: 'child-danger', scope: 'other', food: "kids' meal", menuLabel: "Kids' Meal Box", meaning: 'a child is in danger or being harmed', indicator: 'child in danger', urgency: 'high' },
  { id: 'hazard', scope: 'other', food: 'cold drinks', menuLabel: 'Mint Lemonade', meaning: 'a fire, an accident, a gas leak, or something dangerous around you', indicator: 'fire / accident / hazard', urgency: 'high' },
]

export const ALL_CODES: Code[] = [...SELF_CODES, ...OTHER_CODES]

export const CODE_BY_ID: Record<string, Code> = Object.fromEntries(ALL_CODES.map((c) => [c.id, c]))

const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }

// Builds the persona's Step 4 bullet lists from this table, so the spoken call and the tappable menu always use
// the identical food phrases and meanings. Format matches what persona.ts expects: `- "food" = meaning`.
export function personaCodeList(scope: CodeScope): string {
  return (scope === 'self' ? SELF_CODES : OTHER_CODES).map((c) => `- "${c.food}" = ${c.meaning}`).join('\n')
}

// Decodes a placed "click & order" cart into incident fields (Story 8.2). `lines` pairs a code id with the
// quantity ordered of that coded item. Quantity of a coded item stands in for headcount (the call's "how many
// pizzas" drill-down). `deliveryUrgency` comes from the checkout delivery-speed choice.
export interface DecodedOrder {
  dangerIndicators: string[]
  peopleCount: number | null
  urgency: Severity
  notes: string | null
}

export function decodeOrder(lines: { codeId: string; qty: number }[], deliveryUrgency: Severity): DecodedOrder {
  const codes = lines.map((l) => ({ code: CODE_BY_ID[l.codeId], qty: l.qty })).filter((x) => x.code)

  const dangerIndicators = [...new Set(codes.map((x) => x.code.indicator))]
  // Highest quantity among the coded items approximates how many people are involved.
  const peopleCount = codes.length ? Math.max(...codes.map((x) => x.qty)) : null
  const urgency = codes
    .map((x) => x.code.urgency)
    .concat(deliveryUrgency)
    .reduce((a, b) => (rank[a] >= rank[b] ? a : b), deliveryUrgency)
  const scopes = new Set(codes.map((x) => x.code.scope))
  const notes = codes.length
    ? `Coded order: ${codes.map((x) => `${x.code.menuLabel} (${x.code.meaning})`).join('; ')}.` +
      (scopes.has('other') ? ' Reporting about someone else / the surroundings.' : '')
    : null

  return { dangerIndicators, peopleCount, urgency, notes }
}
