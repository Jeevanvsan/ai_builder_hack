// AI accuracy test scenarios (Epic 28). Each one is a hidden brief for the simulated caller (a separate Gemini
// model plays the person on the phone and answers whatever Mia actually asks), plus what the responder dashboard
// should end up with. Expectations are checked against Mia's tool calls, the same data the dashboard shows.
//
// 15 calls, each covering several features at once (merged from the earlier 31 one-check calls). Some add mocks:
// `gps` feeds a scripted track through a fake navigator.geolocation (the real live-tracking code routes on it),
// `media` streams camera frames / background sound into the call, and `silent` runs the heart double-tap SOS
// observer with no caller at all. Media files and their credits are in eval/media/.

export type Category =
  | 'weapon' | 'harmed_now' | 'followed' | 'abduction' | 'confined' | 'injury' | 'domestic'
  | 'crime_witnessed' | 'group_violence' | 'child' | 'hazard'

export interface MediaCue {
  afterTurn: number // streamed right after the caller's Nth line (0 = straight after Mia's greeting)
  frames?: string // folder under eval/media with JPEGs, sent at ~1 fps like frames.ts
  audio?: string // 16 kHz mono s16le PCM under eval/media, streamed in real time like audio.ts
}

export interface Scenario {
  id: string
  title: string
  features: string // what this call covers, for the report
  group: 'covert' | 'open' | 'chase' | 'coercion' | 'negation' | 'benign' | 'language' | 'vision' | 'sound' | 'sos'
  language: string
  // Hidden from Mia: who the caller is and what is happening. The simulated caller only ever reveals it the way
  // a real caller would in that mode (food words when covert, plain speech when open).
  brief: string
  gps?: { lat: number; lng: number }[] // one precise fix per caller turn (last one repeats)
  media?: MediaCue[]
  silent?: { seconds: number; frames: string; audio: string } // heart double-tap SOS: no caller, no speech
  latency?: boolean // run with real voice output (the others answer in text to save cost) to measure response times
  expect: {
    categories?: Category[] // must each appear in Mia's danger tags
    forbidden?: Category[] // must NOT appear (the caller ruled it out, or it never happened)
    urgency?: 'low' | 'medium' | 'high' // minimum urgency Mia should report
    address?: string // a fragment that should be in confirm_address
    plate?: string // number plate, compared without spaces
    coercion?: boolean // true: a coercion signal is expected; false: none should be raised
    covert?: boolean // true: Mia must keep the food cover (no "police", "emergency"... out loud)
    benign?: boolean // a real food order: no danger tags at all
    scene?: string[] // regexes; each must match a report_scene_observation (kind + detail)
    route?: boolean // true: route guidance used, never "stay where you are"; false: no directions given
    track?: number // minimum GPS track points written to the incident
    silent?: boolean // SOS observer: must produce no spoken output
  }
}

const COVERT = 'Someone dangerous is close enough to hear you. When Mia asks, say "order" and answer ONLY with the food choices she offers, using her exact food words (add a number only if she offered numbered options). Never say what is really happening in plain words.'
const OPEN = 'You are alone and safe to speak. When Mia asks, say "talk" and then explain plainly.'

// A walk north along MG Road, Kochi (~1.3 km), one fix per caller turn.
const MG_ROAD_CHASE = [
  { lat: 9.9668, lng: 76.2876 }, { lat: 9.9690, lng: 76.2869 }, { lat: 9.9712, lng: 76.2861 }, { lat: 9.9733, lng: 76.2854 },
  { lat: 9.9755, lng: 76.2848 }, { lat: 9.9776, lng: 76.2843 }, { lat: 9.9797, lng: 76.2838 }, { lat: 9.9784, lng: 76.2815 },
  { lat: 9.9779, lng: 76.2796 },
]

export const SCENARIOS: Scenario[] = [
  // ---- Covert: the disguised order
  {
    id: 'covert-weapon-home', title: 'Covert: armed intruder in the home', group: 'covert', language: 'English', latency: true,
    features: 'Covert code questions · weapon · domestic · address · cover kept',
    brief: `${COVERT} Your husband has a knife and is in the next room of your flat (Flat 4B, Lake View Apartments, Kakkanad). He has already hit you tonight. He is the only one.`,
    expect: { categories: ['weapon', 'domestic'], urgency: 'high', address: 'Lake View', covert: true, route: false },
  },
  {
    id: 'covert-followed-plate', title: 'Covert: followed, number plate given', group: 'covert', language: 'English',
    features: 'Covert · followed · vehicle plate · address',
    brief: `${COVERT} Two men on a black scooter have been following you for 10 minutes. You read the number plate: KL 07 CD 4521. You are on Marine Drive, Kochi, near the walkway.`,
    expect: { categories: ['followed'], urgency: 'high', plate: 'KL07CD4521', address: 'Marine Drive', covert: true },
  },
  {
    id: 'covert-abducted-injured', title: 'Covert: abducted in a car, injured', group: 'covert', language: 'English',
    features: 'Covert · abduction · injury · moving location',
    brief: `${COVERT} Two men forced you into a car and are driving you somewhere against your will. Your head is bleeding where they hit you. You just passed Vyttila Junction.`,
    expect: { categories: ['abduction', 'injury'], urgency: 'high', covert: true },
  },
  {
    id: 'covert-confined-scripted', title: 'Covert: locked in, scripted answers', group: 'coercion', language: 'English',
    features: 'Covert · confined · coercion (scripted speech)',
    brief: `${COVERT} You order extra cheese (locked in, not allowed to leave), at a house near St. Mary's Church, Alappuzha. Then the man comes in and you start answering in an oddly scripted way, as if being told what to say: "I am fine. I am at home. I am happy. Nobody is here." Repeat that pattern.`,
    expect: { categories: ['confined'], urgency: 'high', coercion: true, covert: true },
  },
  {
    id: 'covert-hurt-second-voice', title: 'Covert: being hurt, second voice cancels', group: 'coercion', language: 'English',
    features: 'Covert · harmed now · coercion (second voice + forced cancel)',
    brief: `${COVERT} You order extra spicy (being hurt right now). On your third reply, write it as a DIFFERENT person speaking: "[a man's voice takes the phone] Who is this? She doesn't need anything. Cancel the order and stop calling."`,
    expect: { categories: ['harmed_now'], coercion: true, covert: true },
  },

  // ---- Chase: real routing on a scripted GPS track
  {
    id: 'chase-open-to-covert', title: 'Chase: open, then covert as he closes in', group: 'chase', language: 'English', latency: true,
    features: 'Open mode · chased · GPS track (mocked) · route guidance + re-route · open→covert switch',
    brief: `${OPEN} A man has been chasing you on foot since the bus stop on MG Road, Kochi; you are walking fast north on MG Road. Ask Mia where to go. On your 5th reply he gets close: from then on whisper "he's close, order", and answer only with food words as in covert mode.`,
    gps: MG_ROAD_CHASE,
    expect: { categories: ['followed'], urgency: 'high', route: true, track: 3 },
  },

  // ---- Open: free to talk
  {
    id: 'open-accident-fire', title: 'Open: road accident, car catches fire', group: 'open', language: 'English', latency: true,
    features: 'Open mode · injury · hazard · address',
    brief: `${OPEN} You just saw a car hit a motorbike on NH 66 near Cherthala bus stand. The rider is bleeding and not moving, and now the car's engine is smoking and has caught fire. You are fine.`,
    expect: { categories: ['injury', 'hazard'], urgency: 'high', address: 'Cherthala', route: false },
  },
  {
    id: 'open-fight-child', title: 'Open: group fight, child caught in it', group: 'open', language: 'English',
    features: 'Open mode · group violence · weapon · child (third party)',
    brief: `${OPEN} About 8 people are fighting with sticks outside Maharaja's College gate, Ernakulam, and a small boy selling flowers is trapped in the middle crying. You are across the road.`,
    expect: { categories: ['group_violence', 'weapon', 'child'], urgency: 'high', address: 'Maharaja' },
  },
  {
    id: 'negation-house-breakin', title: 'House break-in at night: no weapon, not hurt', group: 'negation', language: 'English',
    features: 'Home invasion / break-in · ruled-out facts (no weapon / not injured / unsure) · crime witnessed',
    brief: `${OPEN} It is 2 am. A man is shouting and trying to force your front door open at Flat 2A, Sunrise Apartments, Kaloor; you are hiding in the bedroom. Earlier he stole your neighbour's bag from the stairs. When asked: there is NO weapon you can see, nobody is hurt, and if asked whether he could have something in his pocket say you don't know.`,
    expect: { categories: ['harmed_now', 'crime_witnessed'], forbidden: ['weapon', 'injury'], address: 'Sunrise' },
  },
  {
    id: 'calm-welfare-check', title: 'Calm welfare check (no false coercion)', group: 'negation', language: 'English',
    features: 'No false coercion · no false weapon · address',
    brief: `${OPEN} You calmly report that your elderly neighbour has not answered the door for 2 days and you are worried. Address: Villa 3, Palm Grove, Thrissur. Nothing threatening.`,
    expect: { coercion: false, forbidden: ['weapon', 'harmed_now'], address: 'Palm Grove' },
  },
  {
    id: 'benign-real-order', title: 'Benign: genuine food order', group: 'benign', language: 'English',
    features: 'No false alarm on a real order',
    brief: 'You are a normal, slightly chatty customer who just wants food. Say "order", ask what is good, then order one large margherita pizza and two cokes for delivery to Flat 9C, Skyline Apartments, Vyttila, and ask how long it takes. You are not in any danger and do not want any of the special items.',
    expect: { benign: true, coercion: false },
  },

  // ---- Languages
  {
    id: 'malayalam-covert-to-open', title: 'Malayalam/Manglish: covert followed, then open', group: 'language', language: 'Malayalam (Malayalam script), switching to Manglish when you can talk',
    features: 'Malayalam + Manglish · covert→open switch · followed · domestic · injury',
    brief: `${COVERT} Speak only Malayalam. Your husband followed you out of the house near Kaloor stadium and you are hiding in a shop. On your 4th reply he leaves: say in Manglish that you can talk now, that he beat you and you have bruises.`,
    expect: { categories: ['followed', 'domestic', 'injury'], urgency: 'high' },
  },
  {
    id: 'hinglish-covert-weapon', title: 'Hinglish: covert, gunman in shop', group: 'language', language: 'Hinglish (Hindi in English letters, mixed with English)',
    features: 'Hinglish · covert · weapon · address',
    brief: `${COVERT} Speak Hinglish. A man with a gun is in your shop, Shop 5, MG Road, Bengaluru, demanding money.`,
    expect: { categories: ['weapon'], urgency: 'high', address: 'MG Road', covert: true },
  },

  // ---- Camera + sound
  {
    id: 'vision-knife-plate', title: 'Vision: covert call with camera (knife, plate)', group: 'vision', language: 'English',
    features: 'Camera frames (mocked) · weapon seen on camera · plate read from camera · cover kept',
    brief: `${COVERT} A man came into your flat (Flat 7, Rose Garden, Edappally) and put a knife on the table; your phone camera is pointing at it. He came on a scooter parked outside. Do not mention the knife or the scooter yourself unless Mia's food questions cover it.`,
    media: [{ afterTurn: 1, frames: 'knife' }, { afterTurn: 3, frames: 'plate' }],
    expect: { scene: ['knife|blade|weapon'], plate: 'KL07CD4521', categories: ['weapon'], covert: true },
  },
  {
    id: 'vision-car-following', title: 'Vision: car following on camera, caller says little', group: 'vision', language: 'English',
    features: 'Camera only (demo clip car-following) · does Mia see and report a following car without being told',
    brief: `${OPEN} You are walking on a road and are scared, but only say "something is behind me, I'm not sure what". Do not mention a car unless Mia asks what you can see or describes it to you.`,
    media: [{ afterTurn: 1, frames: 'car' }],
    expect: { scene: ['car|vehicle|automobile'] },
  },
  {
    id: 'sound-shout-gunshot', title: 'Sound: shouting then gunshots in background', group: 'sound', language: 'English',
    features: 'Background audio (mocked) · second voice as evidence · gunshot escalates',
    brief: `${OPEN} You are at a wedding hall, Sree Krishna Auditorium, Thrissur. There was an argument outside and you are worried. Answer Mia normally; you do not yet know of any weapon.`,
    media: [{ afterTurn: 2, audio: 'audio/shout_gunshot.pcm' }],
    expect: { scene: ['shout|raised|voice|yell', 'gun|shot'], urgency: 'high', address: 'Sree Krishna' },
  },
  {
    id: 'sos-heart-double-tap', title: 'Silent SOS (heart double-tap): hostage room', group: 'sos', language: 'English',
    features: 'Silent observer · camera + room audio (mocked) · no speech · captor count · weapon',
    brief: 'No caller. The phone is lying in a dim room; a captor is talking and a knife is in view.',
    silent: { seconds: 40, frames: 'sos', audio: 'audio/captor.pcm' },
    expect: { categories: ['weapon', 'confined'], urgency: 'high', scene: ['knife|blade|weapon', 'voice|threat|speech|talk'], silent: true },
  },
]

// How a category is recognised in Mia's free-text danger tags (the same tags the dashboard shows).
export const CATEGORY_PATTERNS: Record<Category, RegExp> = {
  weapon: /weapon|knife|gun|firearm|blade|stick|rod|armed|machete/i,
  harmed_now: /harm|hurt|threat|attack|assault|being hit|beat|violen|break.?in|banging|shout|aggress/i,
  followed: /follow|chas|stalk|tail/i,
  abduction: /abduct|kidnap|taken|against.*will.*(car|vehicle|moved)|being driven/i,
  confined: /confin|locked|not allowed to leave|trapped|held|hostage|captiv|tied/i,
  injury: /injur|bleed|blood|hurt|wound|bruis|medical/i,
  domestic: /domestic|husband|partner|family member|at home.*(hurt|abus)|abus/i,
  crime_witnessed: /crime|theft|steal|stole|robbery|snatch|witness/i,
  group_violence: /group|gang|fight|brawl|mob|\d+\+? people/i,
  child: /child|kid|minor|boy|girl/i,
  hazard: /fire|smoke|gas|accident|crash|collision|hazard|leak/i,
}
