// QuickOne cover packs (backlog Epic 33): one meaning set, one vocabulary per service. See ./types.ts.

import { OTHER_CODES, SELF_CODES, type CodeScope } from '../codes.ts'
import { FOOD } from './food.ts'
import { GROCERY } from './grocery.ts'
import { HOME } from './home.ts'
import { OTHER } from './other.ts'
import { PHARMACY } from './pharmacy.ts'
import type { CodeId, CoverId, CoverPack } from './types.ts'

export type { CodeId, CoverCode, CoverId, CoverPack, FollowUps } from './types.ts'

export const COVERS: Record<CoverId, CoverPack> = { food: FOOD, grocery: GROCERY, pharmacy: PHARMACY, home: HOME, other: OTHER }

export const COVER_IDS = Object.keys(COVERS) as CoverId[]

export const isCoverId = (v: unknown): v is CoverId => typeof v === 'string' && (COVER_IDS as string[]).includes(v)

// Missing or unknown ids fall back to food: incidents from before cover packs existed have no cover field.
export const coverPack = (id: string | null | undefined): CoverPack => (isCoverId(id) ? COVERS[id] : FOOD)

const ALL_IN_ORDER = [...SELF_CODES, ...OTHER_CODES]

// One line per situation code, `- "phrase" = meaning`. Same order and format as personaCodeList() in codes.ts, so
// the food pack renders exactly the list the persona has always had.
export function coverCodeList(pack: CoverPack, scope: CodeScope): string {
  return (scope === 'self' ? SELF_CODES : OTHER_CODES).map((c) => `- "${pack.codes[c.id as CodeId].phrase}" = ${c.meaning}`).join('\n')
}

// Every situation phrase of a pack with its code id: transcript chips on the dashboard, speech-to-text hints.
export function coverPhrases(pack: CoverPack): { id: CodeId; phrase: string }[] {
  return ALL_IN_ORDER.map((c) => ({ id: c.id as CodeId, phrase: pack.codes[c.id as CodeId].phrase }))
}

// Place names the call's speech-to-text kept mishearing ("Vazhicherry" → "Veterinary"); the same for every cover.
const PLACE_HINTS = [
  'Alappuzha', 'Alleppey', 'Vazhicherry', 'Muhamma', 'Mullakkal', 'Kalavoor', 'Cherthala', 'Kochi', 'Ernakulam',
  'Kottayam', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Bengaluru', 'HSR Layout', 'Koramangala',
  'petrol pump', 'junction', 'police station',
]

// The Live session's customVocabulary for a cover: the app name, Mia, "talk", the covert word, every code phrase and
// the answers to the follow-ups (so a whispered "cola" isn't heard as "Kola"), the place names, and on the neutral
// "Call QuickOne" line the service words a caller names first. The Live API takes at most 75 entries; check-covers.ts
// keeps every cover under that. The food cover with "QuickBite" gives exactly the list used before cover packs.
export function speechHints(pack: CoverPack, appName: string, neutral = false): string[] {
  return [
    appName, 'Mia', 'talk', pack.covertWord,
    ...coverPhrases(pack).map((c) => c.phrase),
    ...pack.vocabulary.filter((v) => v !== pack.covertWord),
    ...(neutral ? ['food', 'groceries', 'medicines', 'repair', 'cab'] : []),
    ...PLACE_HINTS,
  ]
}

// The service the caller's words ask for when it isn't the current one, or null. Drives the mid-call nudge that
// reminds Mia to call set_service; it never switches the cover by itself.
export function serviceAskedFor(text: string, current: CoverId): CoverId | null {
  for (const id of COVER_IDS) if (id !== current && COVERS[id].keywords.test(text)) return id
  return null
}
