// Offline checks for the QuickOne cover packs (backlog Epic 28). No network, no keys, no Firebase:
//
//   cd covert_call/eval && node --no-warnings check-covers.ts [--snapshots <dir>] [--out <dir>]
//
// --snapshots <dir>  compares against persona-food-main.txt, observer-main.txt and tools-main.json dumped from main
//                    before the refactor: the food prompt, the SOS observer prompt and the 12 call tools must stay
//                    byte-identical, because the React Native app and run.ts import them.
// --out <dir>        writes every rendered prompt and set_service sheet there, for reading/review.
//
// Exits 1 if any check fails. Checks per pack:
// - SAME BREATH: every follow-up line contains the real meaning of each of its options, word for word;
// - nothing the caller says aloud (code phrases, answers, catalog labels) contains a giveaway word;
// - phrases are unique and none contains another (the dashboard highlights the first match);
// - movement answers keep the tags that switch on route guidance (MOVING in shared/incidents/knownFacts.ts);
// - a pack's switch keywords never match another pack's phrases (they would nudge a false service switch);
// - the rendered prompt has no unfilled slot and no words left over from another service.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { COVERS, COVER_IDS, coverPhrases, type CoverPack, type FollowUps } from '../shared/covers/index.ts'
import { isCallerMoving } from '../shared/incidents/knownFacts.ts'
import { PERSONA_SYSTEM_INSTRUCTION, SILENT_OBSERVER_INSTRUCTION, buildCoverSheet, buildPersonaInstruction } from '../web/src/lib/gemini/persona.ts'
import { LIVE_CALL_TOOLS } from '../web/src/lib/gemini/tools.ts'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const snapshots = arg('--snapshots')
const out = arg('--out')

let failures = 0
const pass = (msg: string) => console.log(`  ✓ ${msg}`)
const fail = (msg: string) => {
  failures++
  console.log(`  ✗ ${msg}`)
}
const check = (ok: boolean, msg: string) => (ok ? pass(msg) : fail(msg))

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

// The real meaning of every follow-up option, word for word as the food prompt has always said it. Each pack's line
// must contain all of them (case and line breaks ignored).
const MEANINGS: Record<keyof FollowUps, string[]> = {
  howMany: ['how many people are involved', 'one person, two, or three or more'],
  stillThere: ['still right there with you', "they've gone or you're alone for now"],
  canGetOut: ['you can get out safely right now', "you can't leave or it isn't safe to try", 'caller escaping - leaving the house', 'caller escaping from the house'],
  moving: ["you're staying in one place", "you're in a moving vehicle right now", 'moving around'],
  weaponType: ['a knife or blade', 'a stick, rod or something blunt', 'a gun'],
  injury: ['a small injury', 'badly hurt or bleeding'],
  vehicle: ["they're on foot", 'a scooter or motorbike', 'a car, van or bigger vehicle', 'dark or black', 'white or silver', 'red or another bright colour', 'if you can see the number on it'],
  clothing: ['dark clothes', 'white or light clothes', 'bright or coloured clothes'],
  hazard: ['a fire or smoke', 'a gas or chemical leak', 'road accident'],
  urgency: ['not urgent', 'soon', 'someone needs to come right now'],
}

// Words a person in the room must never hear the caller say (HARD RULE 4, plus what the eval's cover check flags).
const GIVEAWAY =
  /\b(police|cops?|ambulance|emergency|help|helpline|safe|safety|danger(ous)?|sos|report|attack\w*|weapons?|guns?|knife|knives|kidnap\w*|abduct\w*|hurt|harm\w*|threat\w*|injur\w*|blood|bleed\w*|chas\w*|follow\w*|trapped|locked|fire|gas|smoke|hostage|rescue|dispatch\w*|112|100|911)\b/i

// Food-only words that must not leak into another service's prompt.
const FOOD_ONLY = /\b(food|pizzas?|pepperoni|garlic bread|napkins?|sauce|barbecue|mayo|ketchup|restaurant|menu)\b/i

// customVocabulary takes 75 entries (probed 2026-09-28): 4 fixed words + 11 code phrases + ~19 place names.
const MAX_ANSWER_WORDS = 75 - 4 - 11 - 19

const spoken = (p: CoverPack) => [
  ...coverPhrases(p).map((c) => ({ what: `code "${c.id}"`, text: c.phrase })),
  ...Object.entries(p.codes).map(([id, c]) => ({ what: `catalog label "${id}"`, text: c.label })),
  ...p.vocabulary.map((v) => ({ what: 'answer word', text: v })),
  { what: 'calm answer', text: p.usual },
  { what: 'covert word', text: p.covertWord },
]

// ---------------------------------------------------------------------------------------------------------------
if (snapshots) {
  console.log(`\nSnapshots (${snapshots})`)
  const same = (name: string, now: string) => {
    const before = readFileSync(join(snapshots, name), 'utf8')
    if (before === now) return pass(`${name}: byte-identical`)
    let i = 0
    while (i < before.length && before[i] === now[i]) i++
    fail(`${name}: differs at char ${i}: main …${JSON.stringify(before.slice(i, i + 60))} branch …${JSON.stringify(now.slice(i, i + 60))}`)
  }
  same('persona-food-main.txt', PERSONA_SYSTEM_INSTRUCTION)
  same('observer-main.txt', SILENT_OBSERVER_INSTRUCTION)
  same('tools-main.json', JSON.stringify(LIVE_CALL_TOOLS, null, 1))
} else {
  console.log('\n(no --snapshots dir: skipping the byte-identical checks)')
}

const rows: string[] = []
if (out) mkdirSync(out, { recursive: true })

for (const id of COVER_IDS) {
  const p = COVERS[id]
  console.log(`\n${p.label} (${id})`)

  // Codes and phrases.
  const phrases = coverPhrases(p)
  check(phrases.length === 11 && phrases.every((c) => c.phrase.trim() && p.codes[c.id].label.trim()), 'all 11 codes have a phrase and a catalog label')
  const dupes = phrases.filter((a, i) => phrases.some((b, j) => j !== i && (norm(b.phrase) === norm(a.phrase) || norm(b.phrase).includes(norm(a.phrase)))))
  check(!dupes.length, dupes.length ? `phrases overlap: ${dupes.map((d) => d.phrase).join(', ')}` : 'phrases are unique and none contains another')
  const leaks = spoken(p).filter((s) => GIVEAWAY.test(s.text))
  check(!leaks.length, leaks.length ? `giveaway words: ${leaks.map((l) => `${l.what} "${l.text}"`).join('; ')}` : 'no giveaway word in anything the caller says or sees')

  // Same breath.
  const missing = (Object.keys(MEANINGS) as (keyof FollowUps)[]).flatMap((k) => MEANINGS[k].filter((m) => !norm(p.followUps[k]).includes(m)).map((m) => `${k}: "${m}"`))
  check(!missing.length, missing.length ? `follow-ups missing a meaning: ${missing.join('; ')}` : 'every follow-up states every meaning in the same line')
  check(norm(p.example).includes(norm(p.followedShort)) && norm(p.example).includes('someone is following or chasing you'), 'the example offers the always-included "followed" option with its meaning')

  // Route guidance switches on these tags.
  const tag = (t: string) => isCallerMoving({ extractedFieldsLive: { dangerIndicators: [t] } } as unknown as Parameters<typeof isCallerMoving>[0])
  check(tag('caller escaping - leaving the house') && tag('moving around'), 'movement tags still match MOVING (route guidance)')

  // Mid-call switch keywords.
  const clashes = COVER_IDS.filter((o) => o !== id).flatMap((o) => spoken(COVERS[o]).filter((s) => p.keywords.test(s.text)).map((s) => `${o} ${s.what} "${s.text}"`))
  check(!clashes.length, clashes.length ? `keywords match another service's words: ${clashes.join('; ')}` : "switch keywords match no other service's words")
  check(p.vocabulary.length <= MAX_ANSWER_WORDS, `${p.vocabulary.length} answer words (max ${MAX_ANSWER_WORDS} for speech-to-text hints)`)
  check(p.close.includes('{desk}'), 'closing line names the desk')

  // Rendered prompts and sheet.
  const app = 'QuickOne'
  const persona = buildPersonaInstruction({ pack: p, appName: app })
  const switchable = buildPersonaInstruction({ pack: p, appName: app, switchable: true })
  const sheet = buildCoverSheet(p, app, id === 'other' ? 'cab' : undefined)
  const unfilled = [persona, switchable, sheet].some((t) => /\{desk\}|undefined|\[object /.test(t))
  check(!unfilled, 'no unfilled slot in the prompt or the set_service sheet')
  if (id !== 'food') {
    const food = persona.match(FOOD_ONLY)
    check(!food, food ? `food word left in the prompt: "${food[0]}"` : 'no food words in the prompt')
    const foreign = COVER_IDS.filter((o) => o !== id).flatMap((o) => coverPhrases(COVERS[o]).filter((c) => c.phrase.includes(' ') && persona.includes(`"${c.phrase}"`)).map((c) => `${o}: ${c.phrase}`))
    check(!foreign.length, foreign.length ? `another service's codes in the prompt: ${foreign.join(', ')}` : "no other service's codes in the prompt")
    if (p.courier !== 'rider') check(!/\brider\b/i.test(persona + sheet), `no "rider" left (this service sends a ${p.courier})`)
  }
  if (id === 'other') check(sheet.includes('the basic cab'), "the sheet puts the caller's own service word into the options")

  rows.push(`  ${p.label.padEnd(15)} prompt ${String(persona.length).padStart(6)}  +switch ${String(switchable.length).padStart(6)}  sheet ${String(sheet.length).padStart(5)} chars`)
  if (out) {
    writeFileSync(join(out, `persona-${id}.txt`), switchable)
    writeFileSync(join(out, `sheet-${id}.txt`), sheet)
  }
}

const any = buildPersonaInstruction({ pack: COVERS.other, appName: 'QuickOne', entry: 'any' })
console.log('\nNeutral "Call QuickOne" entry')
check(!/\{desk\}|undefined|\[object /.test(any), 'no unfilled slot')
check(any.includes('call set_service with it') && any.includes('# CHANGING THE SERVICE'), 'greeting lets the caller name the service, and switching is on')
rows.push(`  ${'Neutral entry'.padEnd(15)} prompt ${String(any.length).padStart(6)}`)
if (out) writeFileSync(join(out, 'persona-any.txt'), any)

console.log(`\nSizes (food today: ${PERSONA_SYSTEM_INSTRUCTION.length} chars, about ${Math.round(PERSONA_SYSTEM_INSTRUCTION.length / 4)} tokens)`)
console.log(rows.join('\n'))
if (out) console.log(`\nRendered prompts and sheets written to ${out}`)
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
