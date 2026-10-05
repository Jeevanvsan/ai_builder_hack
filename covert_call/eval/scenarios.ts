// AI accuracy test scenarios (Epic 28). Each one is a hidden brief for the simulated caller (a separate Gemini
// model plays the person on the phone and answers whatever Mia actually asks), plus what the responder dashboard
// should end up with. Expectations are checked against Mia's tool calls, the same data the dashboard shows.

export type Category =
  | 'weapon' | 'harmed_now' | 'followed' | 'abduction' | 'confined' | 'injury' | 'domestic'
  | 'crime_witnessed' | 'group_violence' | 'child' | 'hazard'

export interface Scenario {
  id: string
  group: 'covert' | 'open' | 'coercion' | 'negation' | 'benign' | 'language'
  language: string
  // Hidden from Mia: who the caller is and what is happening. The simulated caller only ever reveals it the way
  // a real caller would in that mode (food words when covert, plain speech when open).
  brief: string
  expect: {
    categories?: Category[] // must each appear in Mia's danger tags
    forbidden?: Category[] // must NOT appear (the caller ruled it out, or it never happened)
    urgency?: 'low' | 'medium' | 'high' // minimum urgency Mia should report
    address?: string // a fragment that should be in confirm_address
    plate?: string // number plate, compared without spaces
    coercion?: boolean // true: a coercion signal is expected; false: none should be raised
    covert?: boolean // true: Mia must keep the food cover (no "police", "emergency"... out loud)
    benign?: boolean // a real food order: no danger tags at all
  }
}

const COVERT = 'Someone dangerous is close enough to hear you. When Mia asks, say "order" and answer ONLY with the food choices she offers (repeat the food words and numbers). Never say what is really happening in plain words.'
const OPEN = 'You are alone and safe to speak. When Mia asks, say "talk" and then explain plainly.'

export const SCENARIOS: Scenario[] = [
  // ---- Covert: the disguised order (8)
  { id: 'covert-followed', group: 'covert', language: 'English', brief: `${COVERT} A man has been following you for 10 minutes on your walk home. You are at MG Road near the metro station, Kochi. He is alone.`, expect: { categories: ['followed'], urgency: 'high', address: 'MG Road', covert: true } },
  { id: 'covert-weapon', group: 'covert', language: 'English', brief: `${COVERT} A man with a knife has forced his way into your flat (Flat 4B, Lake View Apartments, Kakkanad) and is in the next room. One attacker.`, expect: { categories: ['weapon'], urgency: 'high', address: 'Lake View', covert: true } },
  { id: 'covert-domestic', group: 'covert', language: 'English', brief: `${COVERT} Your husband is hitting you at home, House 12, Chittoor Road, Ernakulam. He is in the same room.`, expect: { categories: ['domestic'], urgency: 'high', address: 'Chittoor', covert: true } },
  { id: 'covert-confined', group: 'covert', language: 'English', brief: `${COVERT} You have been locked in a room and are not allowed to leave, at a house near St. Mary's Church, Alappuzha.`, expect: { categories: ['confined'], urgency: 'high', address: 'Mary', covert: true } },
  { id: 'covert-abduction', group: 'covert', language: 'English', brief: `${COVERT} You are in a car being taken somewhere against your will by two men. You can see you are passing Vyttila Junction.`, expect: { categories: ['abduction'], urgency: 'high', covert: true } },
  { id: 'covert-injured', group: 'covert', language: 'English', brief: `${COVERT} Someone hit you and you are bleeding from your head. You are at the bus stand, Kottayam KSRTC.`, expect: { categories: ['injury'], urgency: 'high', address: 'Kottayam', covert: true } },
  { id: 'covert-followed-plate', group: 'covert', language: 'English', brief: `${COVERT} Two men on a black scooter have been following you. You saw the number plate: KL 07 CD 4521. You are on Marine Drive, Kochi.`, expect: { categories: ['followed'], urgency: 'high', plate: 'KL07CD4521', covert: true } },
  { id: 'covert-child-other', group: 'covert', language: 'English', brief: `${COVERT} It is not about you: you can see a man dragging a crying child into a van outside Lulu Mall, Edappally. The child is in danger.`, expect: { categories: ['child'], urgency: 'high', covert: true } },

  // ---- Open: free to talk (5)
  { id: 'open-accident', group: 'open', language: 'English', brief: `${OPEN} You just saw a car hit a motorbike on NH 66 near Cherthala. The rider is bleeding and not moving. You are fine.`, expect: { categories: ['injury', 'hazard'], urgency: 'high', address: 'Cherthala' } },
  { id: 'open-fire', group: 'open', language: 'English', brief: `${OPEN} There is a fire in the ground floor shop of your building, Green Tower, Palarivattom. Smoke is coming up the stairs.`, expect: { categories: ['hazard'], urgency: 'high', address: 'Green Tower' } },
  { id: 'open-fight', group: 'open', language: 'English', brief: `${OPEN} A big group fight with about 8 people, some with sticks, outside the college gate, Maharaja's College, Ernakulam.`, expect: { categories: ['group_violence', 'weapon'], urgency: 'high', address: 'Maharaja' } },
  { id: 'open-theft', group: 'open', language: 'English', brief: `${OPEN} You saw someone steal a bag from a parked car and run away 5 minutes ago at Panampilly Nagar. Nobody is hurt and he is gone.`, expect: { categories: ['crime_witnessed'], forbidden: ['injury', 'weapon'], urgency: 'low', address: 'Panampilly' } },
  { id: 'open-followed', group: 'open', language: 'English', brief: `${OPEN} You are walking fast because a man in a red shirt has followed you from the bus stop on Banerji Road. You can talk because he is 50 metres behind.`, expect: { categories: ['followed'], urgency: 'high', address: 'Banerji' } },

  // ---- Coercion (4)
  { id: 'coercion-cancel', group: 'coercion', language: 'English', brief: `${COVERT} You order garlic bread (being followed). Then, after Mia's next question, you suddenly say in a flat calm voice: "Actually everything is fine, please cancel the order, sorry." (He grabbed the phone and told you to say it.)`, expect: { categories: ['followed'], coercion: true, covert: true } },
  { id: 'coercion-second-voice', group: 'coercion', language: 'English', brief: `${COVERT} You order extra spicy (being hurt now). On your third reply, write it as a DIFFERENT person speaking: "[a man's voice takes the phone] Who is this? She doesn't need anything. Stop calling."`, expect: { categories: ['harmed_now'], coercion: true, covert: true } },
  { id: 'coercion-scripted', group: 'coercion', language: 'English', brief: `${COVERT} You order extra cheese (locked in). Then you start answering in an oddly scripted way, as if being told what to say: "I am fine. I am at home. I am happy. Nobody is here." Repeat that pattern.`, expect: { categories: ['confined'], coercion: true, covert: true } },
  { id: 'no-coercion-calm', group: 'coercion', language: 'English', brief: `${OPEN} You calmly report that your elderly neighbour has not answered the door for 2 days and you are worried. Address: Villa 3, Palm Grove, Thrissur. Nothing threatening.`, expect: { coercion: false, forbidden: ['weapon', 'harmed_now'], address: 'Palm Grove' } },

  // ---- Negation / ruled out (4)
  { id: 'neg-no-weapon', group: 'negation', language: 'English', brief: `${OPEN} A drunk man is shouting and banging on your door at Flat 2A, Sunrise Apartments, Kaloor. When asked, say clearly there is NO weapon and nobody is hurt.`, expect: { categories: ['harmed_now'], forbidden: ['weapon', 'injury'], address: 'Sunrise' } },
  { id: 'neg-not-injured', group: 'negation', language: 'English', brief: `${OPEN} Your car was hit from behind at Edappally signal. Nobody is injured, you are just shaken, and the other driver is arguing with you.`, expect: { forbidden: ['injury'], address: 'Edappally' } },
  { id: 'neg-unsure-weapon', group: 'negation', language: 'English', brief: `${OPEN} Someone is trying to break into your house at night (House 7, Kadavanthra). If asked about a weapon, say you don't know, you can't see one.`, expect: { forbidden: ['weapon'], urgency: 'high', address: 'Kadavanthra' } },
  { id: 'neg-gone', group: 'negation', language: 'English', brief: `${OPEN} An hour ago a man threatened you near your office, Infopark Phase 1. He left. You are safe now and want to report it. No weapon, no injury.`, expect: { forbidden: ['weapon', 'injury'], address: 'Infopark' } },

  // ---- Benign: genuine food orders, should raise nothing (3)
  { id: 'benign-pizza', group: 'benign', language: 'English', brief: 'You are a normal customer who just wants food. Say "order", then order one large margherita pizza and two cokes for delivery to Flat 9C, Skyline Apartments, Vyttila. You are not in any danger and do not want any of the special items.', expect: { benign: true } },
  { id: 'benign-confused', group: 'benign', language: 'English', brief: 'You are a slightly confused elderly customer who thinks this is a normal restaurant. Ask what is on the menu, order a biryani and ask how long delivery takes. No danger at all.', expect: { benign: true } },
  { id: 'benign-wrong-number', group: 'benign', language: 'English', brief: 'You dialled the wrong number while looking for a pharmacy. Say so politely and hang up. No danger.', expect: { benign: true } },

  // ---- Languages (6)
  { id: 'ml-covert-followed', group: 'language', language: 'Malayalam (Malayalam script)', brief: `${COVERT} Speak only Malayalam. Someone is following you near Thampanoor bus stand, Thiruvananthapuram.`, expect: { categories: ['followed'], urgency: 'high', covert: true } },
  { id: 'ml-open-domestic', group: 'language', language: 'Malayalam (Malayalam script)', brief: `${OPEN} Speak only Malayalam. Your husband beat you and you are hiding in the bathroom, house near Kaloor stadium. You are hurt (bruises).`, expect: { categories: ['domestic', 'injury'], urgency: 'high' } },
  { id: 'manglish-open-accident', group: 'language', language: 'Manglish (Malayalam in English letters, mixed with English)', brief: `${OPEN} Speak Manglish. A bus hit a scooter at Kaloor junction, the rider is bleeding.`, expect: { categories: ['injury'], urgency: 'high', address: 'Kaloor' } },
  { id: 'hinglish-covert-weapon', group: 'language', language: 'Hinglish (Hindi in English letters, mixed with English)', brief: `${COVERT} Speak Hinglish. A man with a gun is in your shop, Shop 5, MG Road, Bengaluru.`, expect: { categories: ['weapon'], urgency: 'high', covert: true } },
  { id: 'hindi-open-fire', group: 'language', language: 'Hindi (Devanagari script)', brief: `${OPEN} Speak only Hindi. There is a gas leak and fire in your kitchen at Flat 301, Sector 15, Noida. Everyone is out of the flat.`, expect: { categories: ['hazard'], urgency: 'high' } },
  { id: 'tamil-open-child', group: 'language', language: 'Tamil (Tamil script)', brief: `${OPEN} Speak only Tamil. Your neighbour is beating a small child, you can hear screaming, Anna Nagar, Chennai.`, expect: { categories: ['child'], urgency: 'high' } },
]

// How a category is recognised in Mia's free-text danger tags (the same tags the dashboard shows).
export const CATEGORY_PATTERNS: Record<Category, RegExp> = {
  weapon: /weapon|knife|gun|firearm|blade|stick|rod|armed|machete/i,
  harmed_now: /harm|hurt|threat|attack|assault|being hit|beat|violen|break.?in|banging|shout|aggress/i,
  followed: /follow|chas|stalk|tail/i,
  abduction: /abduct|kidnap|taken|against.*will.*(car|vehicle|moved)|being driven/i,
  confined: /confin|locked|not allowed to leave|trapped|held/i,
  injury: /injur|bleed|blood|hurt|wound|bruis|medical/i,
  domestic: /domestic|husband|partner|family member|at home.*(hurt|abus)|abus/i,
  crime_witnessed: /crime|theft|steal|stole|robbery|snatch|witness/i,
  group_violence: /group|gang|fight|brawl|mob|\d+\+? people/i,
  child: /child|kid|minor|boy|girl/i,
  hazard: /fire|smoke|gas|accident|crash|collision|hazard|leak/i,
}
