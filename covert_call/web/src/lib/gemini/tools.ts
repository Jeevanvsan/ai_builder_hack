import { Type, type FunctionDeclaration, type Tool } from '@google/genai'

// Gemini Live function declarations (Story 1.5). The model calls these mid-conversation as it extracts
// information from the coded questions in persona.ts — each call is handled immediately (Epic 3.2/3.3), not
// batched until the end.

export const REPORT_SITUATION: FunctionDeclaration = {
  name: 'report_situation',
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
    },
    required: ['source', 'kind'],
  },
}

export const REPORT_ADVICE: FunctionDeclaration = {
  name: 'report_advice',
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

export const END_CALL: FunctionDeclaration = {
  name: 'end_call',
  description: 'Call this the moment you finish your closing line (e.g. "your order\'s on its way, thanks for calling") — after the caller has confirmed they\'re done, whether that means they gave a clear closing signal or you\'ve gathered what you reasonably can. This actually ends the call, so only call it once you are done speaking.',
  parameters: { type: Type.OBJECT, properties: {} },
}

export const LIVE_CALL_TOOLS: Tool[] = [
  { functionDeclarations: [REPORT_SITUATION, CONFIRM_ADDRESS, REPORT_STRESS_LEVEL, REPORT_SCENE_OBSERVATION, REPORT_CALLER_ESTIMATE, REPORT_ADVICE, GET_ROUTE_GUIDANCE, END_CALL] },
]

// Tools for the silent SOS observer (Epic 11.3): report what it sees/hears, but no conversation-only tools
// (no address confirmation, no end_call — the person ends the SOS with the secret gesture).
export const REPORT_SCENE_OBSERVATION_TOOLS: Tool[] = [
  { functionDeclarations: [REPORT_SITUATION, REPORT_STRESS_LEVEL, REPORT_SCENE_OBSERVATION, REPORT_CALLER_ESTIMATE] },
]
