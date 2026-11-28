// QuickOne cover packs (backlog Epic 33): the words Mia uses for one service.
//
// The MEANINGS never change between services: the 11 situation codes in ../codes.ts (meaning, danger tag, urgency)
// and the ten follow-up meanings (how many, still there, can they get out, moving, weapon type, injury, vehicle,
// clothing, hazard, urgency). A pack only supplies the ordinary words a caller can say out loud on that kind of call,
// plus the cover lines around them (greeting, courier, receipt, goodbye). Tools, danger tags, severity and the
// dashboard only ever see the meanings, so they work the same for every pack.
//
// Rules every pack follows (checked by covert_call/eval/check-covers.ts):
// - every follow-up line states each option's real meaning in the same breath (the one rule with no exceptions);
// - nothing the caller says aloud contains a giveaway word or hints at its meaning;
// - movement answers keep the fixed tags that switch on route guidance ("moving around",
//   "caller escaping - leaving the house").
// Plain data only: this file is loaded by the web app, the React Native app, the dashboard and Node scripts.

export type CoverId = 'food' | 'grocery' | 'pharmacy' | 'home' | 'other'

export type CodeId =
  | 'weapon'
  | 'harmed-now'
  | 'followed'
  | 'taken'
  | 'confined'
  | 'injured'
  | 'domestic'
  | 'crime-witnessed'
  | 'group-fight'
  | 'child-danger'
  | 'hazard'

export interface CoverCode {
  // What Mia offers and the caller says aloud ("vitamin C").
  phrase: string
  // The item's name in that service's catalog ("Vitamin C Tablets").
  label: string
}

// The quoted covert question for each follow-up, with every option's meaning in the same breath. Each line is
// placed after a fixed header in the persona ("- HOW MANY (only if danger and unclear): …").
export interface FollowUps {
  howMany: string
  stillThere: string
  // Also says which answer reports "caller escaping - leaving the house" and starts route guidance.
  canGetOut: string
  moving: string
  weaponType: string
  injury: string
  // Includes the colour question and the number-plate line.
  vehicle: string
  clothing: string
  hazard: string
  urgency: string
}

export interface CoverPack {
  id: CoverId
  // Service tab and dashboard badge ("Pharmacy").
  label: string
  // Added to the app name when Mia names the desk: "thanks for calling QuickOne Pharmacy". Empty for food.
  deskSuffix: string
  // "Mia … at QuickOne Pharmacy".
  business: string
  // "taking a customer's medicine order", "keep it like a normal medicine order".
  kind: string
  // "order" or "booking": "return to the order", "order read-back".
  order: string
  // What the caller says to keep the cover on ("order", "booking").
  covertWord: string
  // "food words" / "food word": what a covert answer is made of.
  words: string
  word: string
  // "While the food cover is on".
  cover: string
  // "Food-order cover, Rules 2-4 strictly".
  coverTitle: string
  // "every question … is a menu choice of 2-3 options".
  choice: string
  // "no rider, no menu" in open mode.
  menu: string
  // "a food answer → COVERT".
  answer: string
  // "Is this order for yourself, or for someone else?"
  whoFor: string
  // "the delivery address, so the rider finds you".
  address: string
  // The person who comes to the caller: rider, technician, driver.
  courier: string
  // "an email for the receipt" / "email you the order receipt".
  receipt: string
  orderReceipt: string
  // "disguised as delivery talk", "ordinary delivery chat".
  talk: string
  codes: Record<CodeId, CoverCode>
  // Short name of the always-offered `followed` option ("garlic bread").
  followedShort: string
  // The calm "nothing dangerous right now" answer ("the usual").
  usual: string
  // The step-3 example question, quoted, with three options and their meanings.
  example: string
  followUps: FollowUps
  // Goodbye at the 3-minute "end now" note.
  budgetGoodbye: string
  // Closing line. {desk} becomes the app name plus deskSuffix.
  close: string
  // "No problem, <this>. Thanks for calling …" after an unanswered call.
  silenceSend: string
  // Answers to the follow-ups, as speech-to-text hints (code phrases are added separately).
  vocabulary: string[]
  // Caller words that ask for this service. Used to nudge Mia to switch service mid-call.
  keywords: RegExp
}
