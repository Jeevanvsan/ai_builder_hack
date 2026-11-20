// Food: the original QuickBite cover. Every value here is copied verbatim from the persona text that was live
// before cover packs existed (including its line breaks), so buildPersonaInstruction() reproduces that prompt
// byte for byte. covert_call/eval/check-covers.ts compares the two. Edit with care: native and the eval harness
// get this exact wording through PERSONA_SYSTEM_INSTRUCTION.

import { ALL_CODES } from '../codes.ts'
import type { CodeId, CoverCode, CoverPack } from './types.ts'

// The phrases and menu labels stay in codes.ts, the single source the menu, checkout and dashboard already read.
const codes = Object.fromEntries(ALL_CODES.map((c) => [c.id, { phrase: c.food, label: c.menuLabel }])) as Record<CodeId, CoverCode>

export const FOOD: CoverPack = {
  id: 'food',
  label: 'Food',
  deskSuffix: '',
  business: 'Restaurant',
  kind: 'food order',
  order: 'order',
  covertWord: 'order',
  words: 'food words',
  word: 'food word',
  cover: 'food cover',
  coverTitle: 'Food-order cover',
  choice: 'menu choice',
  menu: 'menu',
  answer: 'a food answer',
  whoFor: 'order',
  address: 'delivery address',
  courier: 'rider',
  receipt: 'receipt',
  orderReceipt: 'order receipt',
  talk: 'delivery',
  codes,
  followedShort: 'garlic bread',
  usual: 'the usual',
  example: `"Would you like extra spicy, extra pepperoni, or garlic bread on the side? Extra spicy means someone is\nhurting or threatening you right now, extra pepperoni means someone near you has a weapon, garlic bread means\nsomeone is following or chasing you."`,
  followUps: {
    howMany: `"How many pizzas — one, two, or a few? That's how many people are\n  involved: one person, two, or three or more."`,
    stillThere: `"Should the rider hand it to you, or leave it at the door? Hand it to you means\n  the person is still right there with you; leave it at the door means they've gone or you're alone for now."`,
    canGetOut: `"Will you collect it\n  outside, or should the rider bring it in? Collect it outside means you can get out safely right now; bring it in\n  means you can't leave or it isn't safe to try." Collect → report_situation ["caller escaping - leaving the\n  house"], then get_route_guidance (situation "caller escaping from the house") and guide them out. Bring it in →\n  no directions: stay-safe advice (lock the door, stay low and quiet, away from the attacker), stay on the line.`,
    moving: `"Is the order going to one address, or will you be moving around? One\n  address means you're staying in one place; moving around means you're in a moving vehicle right now."`,
    weaponType: `"Small, medium, or large size? Small means a knife or blade, medium means a stick,\n  rod or something blunt, large means a gun."`,
    injury: `"A few napkins or a whole pack? A few means a small injury; a whole pack means\n  someone is badly hurt or bleeding."`,
    vehicle: `"Will you pick it up, or should the rider come by\n  bike or car? Pick up means they're on foot; bike means a scooter or motorbike; car means a car, van or bigger\n  vehicle." Colour: "Which sauce — barbecue, mayo, or ketchup? Barbecue means the vehicle is dark or black, mayo\n  means white or silver, ketchup means red or another bright colour." Plate (only if they can see it safely):\n  "If you can see the number on it, read it to me like an order code." Never insist.`,
    clothing: `"Any drink with that — cola, lemon, or orange?\n  Cola means dark clothes, lemon means white or light clothes, orange means bright or coloured clothes."`,
    hazard: `"Hot or cold? Hot means a fire or smoke; cold means a gas or chemical leak; and say 'on\n  the road' if it's a road accident."`,
    urgency: `"How fast do you need it —\n  whenever, within the hour, or as soon as possible? Whenever means not urgent, within the hour means soon, as soon\n  as possible means someone needs to come right now."`,
  },
  budgetGoodbye: `lovely, your order will reach\n  you in about 20 minutes, take care`,
  close: `Perfect, your order's on its way. Thanks for calling {desk}, take care!`,
  silenceSend: `I'll send it to the address we have`,
  // Same order as the hand-written hint list in web liveSession.ts, so a food call's hints don't change.
  vocabulary: [
    'cola', 'lemon', 'orange', 'a few napkins', 'a whole pack', 'small', 'medium', 'large', 'one pizza', 'two pizzas',
    'a few', 'hand it to me', 'leave it at the door', 'right now', 'pre-order', 'as soon as possible', 'within the hour',
    'whenever', 'pick up', 'bike', 'car', 'barbecue', 'mayo', 'ketchup', 'regular crust', 'large crust', 'the usual',
    'collect it outside', 'bring it in', 'for myself', 'for someone else', 'one address', 'moving around',
  ],
  keywords: /\b(food|pizzas?|burgers?|biryani|dinner|lunch|restaurant|takeaway)\b/i,
}
