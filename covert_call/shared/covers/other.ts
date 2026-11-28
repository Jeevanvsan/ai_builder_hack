// Any other service (a cab, laundry, a salon, a courier…). The covert options are plan/tier words that fit almost
// any booking, and Mia adds the caller's own word for the service ("the basic ride", "the express wash"), so the
// meaning of each option stays fixed whatever the service is. Also the starting sheet for the neutral
// "Call QuickOne" line, until the caller names a service.
// DRAFT wording: review with Ameen before it goes live. Meanings must stay word for word (check-covers.ts).

import type { CoverPack } from './types.ts'

export const OTHER: CoverPack = {
  id: 'other',
  label: 'Other services',
  deskSuffix: '',
  business: 'Services',
  kind: 'booking',
  order: 'booking',
  covertWord: 'booking',
  words: 'booking words',
  word: 'booking word',
  cover: 'booking cover',
  coverTitle: 'Booking cover',
  choice: 'plan choice',
  menu: 'price list',
  answer: 'a booking answer',
  whoFor: 'booking',
  address: 'address',
  courier: 'driver',
  receipt: 'booking confirmation',
  orderReceipt: 'booking confirmation',
  talk: 'booking',
  codes: {
    weapon: { phrase: 'premium', label: 'Premium' },
    'harmed-now': { phrase: 'express', label: 'Express' },
    followed: { phrase: 'basic', label: 'Basic' },
    taken: { phrase: 'economy', label: 'Economy' },
    confined: { phrase: 'standard', label: 'Standard' },
    injured: { phrase: 'deluxe', label: 'Deluxe' },
    domestic: { phrase: 'monthly', label: 'Monthly Plan' },
    'crime-witnessed': { phrase: 'a group booking', label: 'Group Booking' },
    'group-fight': { phrase: 'a bulk booking', label: 'Bulk Booking' },
    'child-danger': { phrase: "the kids' option", label: "Kids' Option" },
    hazard: { phrase: 'the eco option', label: 'Eco Option' },
  },
  followedShort: 'basic',
  usual: 'the usual',
  example: `"Would you like the basic, the express, or the premium one? Basic means someone is following or chasing you, express means someone is hurting or threatening you right now, premium means someone near you has a weapon." Always say the options with the caller's own word for the service ("the basic ride", "the express wash").`,
  followUps: {
    howMany: `"For how many — one, two, or a few? That's how many people are involved: one person, two, or three or more."`,
    stillThere: `"Should the driver call you when he arrives, or just come to the door? Call me means the person is still right there with you; come to the door means they've gone or you're alone for now."`,
    canGetOut: `"Will you come out to meet the driver, or should he come in? Come out means you can get out safely right now; come in means you can't leave or it isn't safe to try." Come out → report_situation ["caller escaping - leaving the house"], then get_route_guidance (situation "caller escaping from the house") and guide them out. Come in → no directions: stay-safe advice (lock the door, stay low and quiet, away from the attacker), stay on the line.`,
    moving: `"Is it one address, or will you be moving around? One address means you're staying in one place; moving around means you're in a moving vehicle right now."`,
    weaponType: `"Small, medium, or large? Small means a knife or blade, medium means a stick, rod or something blunt, large means a gun."`,
    injury: `"A short one or a long one? A short one means a small injury; a long one means someone is badly hurt or bleeding."`,
    vehicle: `"Will you come to us, or should the driver come by bike or car? Come to us means they're on foot; bike means a scooter or motorbike; car means a car, van or bigger vehicle." Colour: "Any colour preference — black, white, or red? Black means the vehicle is dark or black, white means white or silver, red means red or another bright colour." Plate (only if they can see it safely): "If you can see the number on it, read it to me like a booking code." Never insist.`,
    clothing: `"Paying by cash, card, or online? Cash means dark clothes, card means white or light clothes, online means bright or coloured clothes."`,
    hazard: `"Indoors or outdoors? Indoors means a fire or smoke; outdoors means a gas or chemical leak; and say 'on the road' if it's a road accident."`,
    urgency: `"When do you need it — later this week, today, or right now? Later this week means not urgent, today means soon, right now means someone needs to come right now."`,
  },
  budgetGoodbye: `lovely, the driver will reach you in about 20 minutes, take care`,
  close: `Perfect, you're booked. Thanks for calling {desk}, take care!`,
  silenceSend: `I'll send the driver to the address we have`,
  vocabulary: [
    'cash', 'card', 'online', 'a short one', 'a long one', 'small', 'medium', 'large', 'a few', 'call me',
    'come to the door', 'right now', 'today', 'later this week', 'come to us', 'bike', 'car', 'black', 'white', 'red',
    'indoors', 'outdoors', 'on the road', 'the usual', 'come out', 'come in', 'for myself', 'for someone else',
    'one address', 'moving around', 'booking',
  ],
  keywords: /\b(cab|taxi|ride|laundry|salon|courier|parcel|movers|tutor)\b/i,
}
