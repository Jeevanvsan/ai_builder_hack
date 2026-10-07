import { AI_FEATURES } from '../../../../shared/aiFeatures.ts'
import { Behavior, FunctionResponseScheduling, Type, type FunctionDeclaration, type FunctionResponse, type Tool } from '@google/genai'

// Record-only tools: Mia never needs their result, so their responses are SILENT (see toolResponse below).
// Behind a switch until proven (shared/aiFeatures.ts nonBlockingTools).
// No import.meta.env here: native imports this file too.
export const NONBLOCKING_TOOLS = ((globalThis as { QB_NONBLOCKING_TOOLS?: boolean }).QB_NONBLOCKING_TOOLS ?? AI_FEATURES.nonBlockingTools) === true
const nonBlocking = NONBLOCKING_TOOLS ? { behavior: Behavior.NON_BLOCKING } : {}

export const SILENT_TOOL_NAMES = new Set([
  'report_situation', 'report_stress_level', 'report_caller_estimate', 'report_scene_observation', 'report_advice',
  'report_vehicle_number', 'report_coercion_signal', 'confirm_message_delivered',
])

// gemini-3.8-live runs every tool asynchronously by default (NON_BLOCKING), and an async tool's response is
// scheduled WHEN_IDLE unless told otherwise: Gemini starts a NEW reply as soon as Mia is idle. With a report tool
// on almost every turn that meant 20+ extra replies per call, repeated/cut-off sentences and Mia voicing her own
// reasoning. Record-only tools are therefore answered SILENT (the result, including any known-facts text riding
// along, is used later without starting a reply); only tools whose answer Mia must act on start one (WHEN_IDLE).
// Scheduling for one batch of tool calls. Tested on gemini-3.8-live (2026-10-05): when Mia's turn so far is ONLY
// tool calls, answering them all SILENT left her silent (she never went on to answer the caller); answering them
// all WHEN_IDLE gave a new reply per tool (duplicate, cut-off sentences). So exactly one response may start a
// reply: the tool whose answer she must act on, or, if she hasn't spoken since the caller did, the last one.
export function batchResponses(calls: { id?: string; name?: string }[], outputs: string[], spokeSinceCaller: boolean): FunctionResponse[] {
  const isRecord = (c: { name?: string }) => !!c.name && (SILENT_TOOL_NAMES.has(c.name) || c.name === 'end_call')
  let replyAt = calls.findIndex((c) => !isRecord(c))
  if (replyAt < 0 && !spokeSinceCaller) replyAt = calls.length - 1
  return calls.map((c, i) => toolResponse(c, outputs[i], i !== replyAt))
}

export function toolResponse(call: { id?: string; name?: string }, output = 'ok', silent = !!call.name && (SILENT_TOOL_NAMES.has(call.name) || call.name === 'end_call')): FunctionResponse {
  return { id: call.id, name: call.name, response: { output }, scheduling: silent ? FunctionResponseScheduling.SILENT : FunctionResponseScheduling.WHEN_IDLE }
}

// Gemini Live function declarations (Story 1.5). The model calls these mid-conversation as it extracts
// information from the coded questions in persona.ts — each call is handled immediately (Epic 3.2/3.3), not
// batched until the end.

export const REPORT_SITUATION: FunctionDeclaration = {
  name: 'report_situation',
  ...nonBlocking,
  description: 'Report any newly learned or updated details about the caller\'s situation. Call this as soon as you learn something, even partial — do not wait for the full picture.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      peopleCount: { type: Type.INTEGER, description: 'Number of people present, if known' },
      dangerIndicators: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Short tags for the NEW danger signals learned from the latest answer only — earlier tags are kept automatically, so do not resend them. Give each distinct fact its own specific tag, e.g. "weapon: knife", "attacker still present", "victim injured - bleeding", "attacker on scooter", "child involved", "3+ people involved".',
      },
      urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'How urgent the situation seems' },
      notes: { type: Type.STRING, description: 'Any other free-form detail worth passing to a responder' },
    },
  },
}

export const SEND_CASE_REPORT: FunctionDeclaration = {
  name: 'send_case_report',
  description: 'Call this when the caller gives an email address for their case report (confirmed=false), then read the address back and ask if it is right; call it again with confirmed=true only after they say yes. The full report (reference number, location, route, what was seen and heard) is emailed to it after the call.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      email: { type: Type.STRING, description: 'The email address in standard syntax: name@domain.tld, lowercase, no spaces, with "@" and "." as symbols (never the words "at" or "dot"), and every correction the caller made applied. Right: "jeevan.v@gmail.com". Wrong: "jeevan v at gmail dot com", "jeevanv gmail com". This exact value is saved and the report is sent to it.' },
      confirmed: { type: Type.BOOLEAN, description: 'true only after the caller has confirmed the address you read back' },
    },
    required: ['email'],
  },
}

export const CONFIRM_ADDRESS: FunctionDeclaration = {
  name: 'confirm_address',
  description: 'Call this the moment the caller states their delivery address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      address: { type: Type.STRING, description: 'The address exactly as the caller said it' },
    },
    required: ['address'],
  },
}

export const REPORT_STRESS_LEVEL: FunctionDeclaration = {
  name: 'report_stress_level',
  ...nonBlocking,
  description: 'Report your current estimate of the caller\'s vocal stress/duress from tone, pace and pitch. Call periodically through the call, roughly every 15-20 seconds, independent of what is being said.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER, description: '0-100 estimate, higher means more stressed/under duress' },
    },
    required: ['score'],
  },
}

export const REPORT_CALLER_ESTIMATE: FunctionDeclaration = {
  name: 'report_caller_estimate',
  ...nonBlocking,
  description:
    "Report your best rough guess of the caller's approximate age group and gender, from their voice (and camera " +
    'image if visible) — NOT something the caller stated. This is only ever a rough estimate a responder should ' +
    'treat as unconfirmed, useful mainly to flag a child or elderly caller (different urgency/handling). Call it ' +
    'once, early in the call, as soon as you have a reasonable impression — do not ask the caller about it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      ageGroup: { type: Type.STRING, enum: ['child', 'teen', 'adult', 'elderly', 'unclear'], description: 'Rough age bracket' },
      gender: { type: Type.STRING, enum: ['male', 'female', 'unclear'], description: "Rough guess of the caller's gender, from voice/appearance" },
      confidence: { type: Type.NUMBER, description: '0-100 how sure you are — usually low-to-moderate for this' },
    },
    required: ['ageGroup', 'gender'],
  },
}

export const REPORT_SCENE_OBSERVATION: FunctionDeclaration = {
  name: 'report_scene_observation',
  ...nonBlocking,
  description:
    "Report something you SEE in the caller's camera or HEAR in the background (not something the caller told you). " +
    'Examples to see: a person visible, a weapon-like object, an injury, smoke or fire, a vehicle. Examples to hear: ' +
    'a gunshot, screaming or crying, other people talking or shouting, breaking glass, banging, a siren, an alarm. ' +
    'Call this the moment you notice it. Never say aloud what you saw or heard.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      source: { type: Type.STRING, enum: ['camera', 'sound'], description: "'camera' if you saw it, 'sound' if you heard it" },
      kind: { type: Type.STRING, description: 'Short tag, e.g. "gunshot", "raised voices", "weapon", "injury", "fire", "vehicle"' },
      detail: { type: Type.STRING, description: 'A short plain-language description for a responder, e.g. "two other male voices, angry" or "handgun on the table"' },
      confidence: { type: Type.NUMBER, description: '0-100 how sure you are' },
      // The AI classifies what it saw, so the dashboard and the case summary don't have to guess from keywords.
      category: {
        type: Type.STRING,
        enum: ['vehicle', 'person', 'weapon', 'injury', 'fire_hazard', 'location_clue', 'sound_event', 'other'],
        description: 'What kind of thing this is',
      },
      vehicleType: { type: Type.STRING, description: 'Vehicles only: e.g. "car", "sports car", "scooter", "auto-rickshaw", "van"' },
      colour: { type: Type.STRING, description: 'Vehicles (or clothing): the main colour you see, e.g. "yellow"' },
      plate: { type: Type.STRING, description: 'Vehicles only: the number plate if readable (also call report_vehicle_number)' },
    },
    required: ['source', 'kind', 'category'],
  },
}

export const REPORT_ADVICE: FunctionDeclaration = {
  name: 'report_advice',
  ...nonBlocking,
  description:
    'Log a piece of short safety advice you just gave the caller out loud (e.g. move away from windows, lock the ' +
    'door, apply pressure to a wound). Call this right after you say it, so a responder knows what the caller was told.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'The advice, in plain responder language' },
    },
    required: ['text'],
  },
}

export const GET_ROUTE_GUIDANCE: FunctionDeclaration = {
  name: 'get_route_guidance',
  description:
    "Get live turn-by-turn directions from the caller's current GPS position to the best place of safety (police for " +
    'chasing/threats, hospital for injury, fire station for fire). Call it when the caller is being chased, is moving, ' +
    'is in the road, or is unsafe where they are, and again whenever they say they reached a junction or landmark. ' +
    'Returns the destination, distance, and the next instruction.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      situation: { type: Type.STRING, description: 'Short reason, e.g. "being chased by a car", "injured", "fire nearby"' },
      landmark: { type: Type.STRING, description: 'Where the caller says they are now, e.g. "at a junction near a petrol pump"' },
    },
  },
}

export const REPORT_VEHICLE_NUMBER: FunctionDeclaration = {
  name: 'report_vehicle_number',
  ...nonBlocking,
  description:
    "Report a suspect vehicle's number plate (Epic 22.3), full or partial, the moment you learn it: from the caller " +
    '(source "caller") or read off a camera frame (source "camera"). Even part of a plate ("KL 04") helps. Never ' +
    'say a plate you read on camera out loud.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      plate: { type: Type.STRING, description: 'The plate as heard or seen, e.g. "KL 04 AB 1234" or "KL 04"' },
      source: { type: Type.STRING, enum: ['caller', 'camera'], description: "'caller' if they told you, 'camera' if you read it" },
      confidence: { type: Type.NUMBER, description: '0-100 how sure you are of the characters' },
    },
    required: ['plate', 'source'],
  },
}

export const REPORT_COERCION_SIGNAL: FunctionDeclaration = {
  name: 'report_coercion_signal',
  ...nonBlocking,
  description:
    "Report a sign the caller may be speaking under someone else's control (Epic 24): a different voice takes over " +
    'the call, the caller suddenly turns flat, calm or scripted after sounding scared, someone whispers instructions ' +
    'to them, or they abruptly try to cancel after danger was mentioned. Call it silently; never react out loud.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      kind: {
        type: Type.STRING,
        enum: ['second voice', 'scripted tone', 'whispered instructions', 'forced cancel', 'other'],
        description: 'What you noticed',
      },
      detail: { type: Type.STRING, description: 'Short plain description for a responder, e.g. "male voice took the phone, said all fine"' },
      confidence: { type: Type.NUMBER, description: '0-100 how sure you are' },
    },
    required: ['kind'],
  },
}

export const CONFIRM_MESSAGE_DELIVERED: FunctionDeclaration = {
  name: 'confirm_message_delivered',
  ...nonBlocking,
  description:
    'Call this right after you pass a responder message on to the caller (Epic 23), with the exact words you said, ' +
    'so the responder sees it was delivered and how it was phrased.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      messageId: { type: Type.STRING, description: 'The id given in the responder-message system note' },
      spokenAs: { type: Type.STRING, description: 'Exactly what you said to the caller' },
    },
    required: ['messageId', 'spokenAs'],
  },
}

export const END_CALL: FunctionDeclaration = {
  name: 'end_call',
  description: 'Call this the moment you finish your closing line (e.g. "your order\'s on its way, thanks for calling") — after the caller has confirmed they\'re done, whether that means they gave a clear closing signal or you\'ve gathered what you reasonably can. This actually ends the call, so only call it once you are done speaking.',
  parameters: { type: Type.OBJECT, properties: {} },
}

export const LIVE_CALL_TOOLS: Tool[] = [
  { functionDeclarations: [REPORT_SITUATION, CONFIRM_ADDRESS, REPORT_STRESS_LEVEL, REPORT_SCENE_OBSERVATION, REPORT_CALLER_ESTIMATE, REPORT_ADVICE, GET_ROUTE_GUIDANCE, REPORT_VEHICLE_NUMBER, REPORT_COERCION_SIGNAL, CONFIRM_MESSAGE_DELIVERED, SEND_CASE_REPORT, END_CALL] },
]

// Tools for the silent SOS observer (Epic 11.3): report what it sees/hears, but no conversation-only tools
// (no address confirmation, no end_call — the person ends the SOS with the secret gesture).
export const REPORT_SCENE_OBSERVATION_TOOLS: Tool[] = [
  { functionDeclarations: [REPORT_SITUATION, REPORT_STRESS_LEVEL, REPORT_SCENE_OBSERVATION, REPORT_CALLER_ESTIMATE, REPORT_VEHICLE_NUMBER] },
]
